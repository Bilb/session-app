#import <React/RCTBridgeModule.h>
#import <React/RCTImageURLLoader.h>

#import <ImageIO/ImageIO.h>
#import <UIKit/UIKit.h>

#include "MediaSource.hpp"

#include <session_bridge/media_url.hpp>

#include <algorithm>
#include <atomic>
#include <cmath>
#include <memory>
#include <string>
#include <utility>

static NSString* const SessionMediaErrorDomain = @"SessionMedia";

static NSError* SessionMediaError(const std::string& message) {
    return [NSError errorWithDomain:SessionMediaErrorDomain
                               code:1
                           userInfo:@{
                               NSLocalizedDescriptionKey : [NSString stringWithUTF8String:message.c_str()]
                           }];
}

/// The source's stored pixel size from its header, or zero when it does not say.
static CGSize SourcePixelSize(CGImageSourceRef source) {
    NSDictionary* properties =
            (__bridge_transfer NSDictionary*)CGImageSourceCopyPropertiesAtIndex(source, 0, nullptr);
    return CGSizeMake(
            [properties[(id)kCGImagePropertyPixelWidth] doubleValue],
            [properties[(id)kCGImagePropertyPixelHeight] doubleValue]);
}

/// The longest edge a decode may have for a view of `longest` device pixels.
///
/// The fit never reaches a loader (Fabric asks with stretch for every request), so this assumes
/// `cover`: the picture's shorter edge spans the view, and its longer edge overshoots by the aspect
/// ratio. Never past the file's own size, so nothing is upsized.
static CGFloat ThumbnailBound(CGFloat longest, CGSize pixels) {
    if (pixels.width <= 0 || pixels.height <= 0)
        return longest;
    const CGFloat aspect = std::max(pixels.width / pixels.height, pixels.height / pixels.width);
    return std::min(std::ceil(longest * aspect), std::max(pixels.width, pixels.height));
}

/// Decodes on the calling queue rather than at first draw, and no larger than the view asks for:
/// a thumbnail with the file's orientation applied, which is also what keeps a 12-megapixel photo
/// from being held whole for a tile.
static UIImage* _Nullable DecodedImage(NSData* data, CGSize size, CGFloat scale) {
    CGImageSourceRef source = CGImageSourceCreateWithData((__bridge CFDataRef)data, nullptr);
    if (!source)
        return nil;
    NSMutableDictionary* options = [@{
        (id)kCGImageSourceCreateThumbnailFromImageAlways : @YES,
        (id)kCGImageSourceCreateThumbnailWithTransform : @YES,
        (id)kCGImageSourceShouldCacheImmediately : @YES,
    } mutableCopy];
    const CGFloat longest = std::max(size.width, size.height) * std::max<CGFloat>(scale, 1);
    if (longest > 0)
        options[(id)kCGImageSourceThumbnailMaxPixelSize] =
                @(ThumbnailBound(longest, SourcePixelSize(source)));
    CGImageRef decoded =
            CGImageSourceCreateThumbnailAtIndex(source, 0, (__bridge CFDictionaryRef)options);
    CFRelease(source);
    if (!decoded)
        return nil;
    UIImage* image = [UIImage imageWithCGImage:decoded scale:std::max<CGFloat>(scale, 1)
                                   orientation:UIImageOrientationUp];
    CGImageRelease(decoded);
    return image;
}

/// A preview's RGBA, which is not premultiplied - what `kCGImageAlphaLast` describes.
static UIImage* _Nullable PreviewImage(std::shared_ptr<::session_bridge::Preview> preview) {
    // Bounded as doubles first: a JavaScript source may answer NaN or 1e12, and casting either
    // to size_t is undefined before the check would run.
    constexpr double max_edge = 16384;
    const double w = preview->width, h = preview->height;
    if (!(w > 0 && w <= max_edge && h > 0 && h <= max_edge))
        return nil;
    const auto width = static_cast<size_t>(w);
    const auto height = static_cast<size_t>(h);
    if (preview->rgba.size() != width * height * 4)
        return nil;
    // The provider keeps the preview alive for as long as the image needs its pixels.
    auto* held = new std::shared_ptr<::session_bridge::Preview>(std::move(preview));
    CGDataProviderRef provider = CGDataProviderCreateWithData(
            held, (*held)->rgba.data(), (*held)->rgba.size(), [](void* info, const void*, size_t) {
                delete static_cast<std::shared_ptr<::session_bridge::Preview>*>(info);
            });
    CGColorSpaceRef colours = CGColorSpaceCreateWithName(kCGColorSpaceSRGB);
    CGImageRef image = CGImageCreate(
            width,
            height,
            8,
            32,
            width * 4,
            colours,
            kCGBitmapByteOrderDefault | kCGImageAlphaLast,
            provider,
            nullptr,
            false,
            kCGRenderingIntentDefault);
    CGColorSpaceRelease(colours);
    CGDataProviderRelease(provider);
    if (!image)
        return nil;
    UIImage* result = [UIImage imageWithCGImage:image];
    CGImageRelease(image);
    return result;
}

/**
 * Draws `session-media://` URLs: the image loader behind `MediaPort.urlFor` on iOS.
 *
 * Registered through `codegenConfig.ios.modulesConformingToProtocol` in this package's
 * package.json, which is what reaches React Native's image loader on the new architecture. The URL
 * is the request: parsed here, answered by whichever source is serving - the open bridge, or the
 * fake through `serveMediaFrom` - and never passed through JavaScript.
 */
@interface SessionMediaImageLoader : NSObject <RCTBridgeModule, RCTImageURLLoader>
@end

@implementation SessionMediaImageLoader {
    dispatch_queue_t _drain;
}

RCT_EXPORT_MODULE()

+ (BOOL)requiresMainQueueSetup {
    return NO;
}

/// Concurrent: every block owns what it touches, and a microsecond preview must not wait behind
/// an album's decodes.
- (instancetype)init {
    if (self = [super init])
        _drain = dispatch_queue_create(
                "session-media",
                dispatch_queue_attr_make_with_qos_class(
                        DISPATCH_QUEUE_CONCURRENT, QOS_CLASS_USER_INITIATED, 0));
    return self;
}

- (BOOL)canLoadImageURL:(NSURL*)requestURL {
    return [requestURL.scheme isEqualToString:@"session-media"];
}

- (BOOL)requiresScheduling {
    return YES;
}

- (BOOL)shouldCacheLoadedImages {
    return YES;
}

- (float)loaderPriority {
    return 10;
}

/// Starts the fetch and returns: the answer arrives on Core's loop or the JS thread, where it is
/// only handed to this loader's own queue, which checks it, decodes it and completes.
- (nullable RCTImageLoaderCancellationBlock)loadImageForURL:(NSURL*)imageURL
                                                       size:(CGSize)size
                                                      scale:(CGFloat)scale
                                                 resizeMode:(RCTResizeMode)resizeMode
                                            progressHandler:(RCTImageLoaderProgressBlock)progressHandler
                                         partialLoadHandler:
                                                 (RCTImageLoaderPartialLoadBlock)partialLoadHandler
                                          completionHandler:
                                                  (RCTImageLoaderCompletionBlock)completionHandler {
    const auto parsed = ::session_bridge::parse_media_url(imageURL.absoluteString.UTF8String);
    if (!parsed) {
        completionHandler(SessionMediaError("not a media URL"), nil);
        return nil;
    }
    auto source = ::session_bridge_rn::media_source();
    if (!source) {
        completionHandler(SessionMediaError("nothing is serving media"), nil);
        return nil;
    }

    auto cancelled = std::make_shared<std::atomic<bool>>(false);
    dispatch_queue_t drain = _drain;
    RCTImageLoaderCompletionBlock done = [completionHandler copy];

    if (parsed->kind == ::session_bridge::MediaUrlKind::preview) {
        source->fetch_preview(parsed->message_id, parsed->index, [=](::session_bridge::Preview answer) {
            auto preview = std::make_shared<::session_bridge::Preview>(std::move(answer));
            dispatch_async(drain, ^{
                if (cancelled->load())
                    return;
                if (preview->error) {
                    done(SessionMediaError(*preview->error), nil);
                    return;
                }
                UIImage* image = PreviewImage(preview);
                done(image ? nil : SessionMediaError("a preview whose pixels do not match its size"),
                     image);
            });
        });
    } else {
        source->fetch_media(parsed->message_id, parsed->index, [=](::session_bridge::Media answer) {
            auto media = std::make_shared<::session_bridge::Media>(std::move(answer));
            dispatch_async(drain, ^{
                if (cancelled->load())
                    return;
                if (media->error) {
                    done(SessionMediaError(*media->error), nil);
                    return;
                }
                const auto type =
                        ::session_bridge::servable_content_type(media->content_type, media->bytes);
                // Images only: a video has no decoder here, and `ftyp` bytes may be HEIF.
                if (!type || !type->starts_with("image/")) {
                    done(SessionMediaError("not a picture the decoder may be handed"), nil);
                    return;
                }
                // Not copied: the deallocator holds `media` for as long as ImageIO holds the data.
                NSData* data = [[NSData alloc] initWithBytesNoCopy:media->bytes.data()
                                                            length:media->bytes.size()
                                                       deallocator:^(void*, NSUInteger) {
                                                           (void)media;
                                                       }];
                UIImage* image = DecodedImage(data, size, scale);
                done(image ? nil : SessionMediaError("the picture did not decode"), image);
            });
        });
    }

    return ^{
        cancelled->store(true);
    };
}

@end
