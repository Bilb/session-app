#include "mark_downloaded.hpp"

#if defined(_WIN32)
#include <fstream>
#elif defined(__APPLE__)
#include <TargetConditionals.h>
#if TARGET_OS_OSX
#include <CoreFoundation/CoreFoundation.h>
#include <CoreServices/CoreServices.h>
#endif
#endif

namespace session_bridge {

// TODO: build and run on Windows and macOS; only the no-op branch has been compiled so far.
void mark_downloaded(const std::filesystem::path& file) noexcept {
#if defined(_WIN32)
    // An alternate data stream on the file itself. Zone 3 is the internet zone.
    try {
        std::ofstream mark{
                std::filesystem::path{file.native() + L":Zone.Identifier"},
                std::ios::binary | std::ios::trunc};
        mark << "[ZoneTransfer]\r\nZoneId=3\r\n";
    } catch (...) {
    }
#elif defined(__APPLE__) && TARGET_OS_OSX
    // Through the URL property rather than by writing the xattr: the property is what Launch
    // Services documents, and the attribute's text format is not.
    const auto native = file.native();
    CFURLRef url = CFURLCreateFromFileSystemRepresentation(
            kCFAllocatorDefault,
            reinterpret_cast<const UInt8*>(native.data()),
            static_cast<CFIndex>(native.size()),
            false);
    if (!url)
        return;
    const void* keys[] = {kLSQuarantineTypeKey, kLSQuarantineAgentNameKey};
    const void* values[] = {kLSQuarantineTypeWebDownload, CFSTR("Session")};
    CFDictionaryRef properties = CFDictionaryCreate(
            kCFAllocatorDefault,
            keys,
            values,
            2,
            &kCFTypeDictionaryKeyCallBacks,
            &kCFTypeDictionaryValueCallBacks);
    if (properties) {
        CFURLSetResourcePropertyForKey(url, kCFURLQuarantinePropertiesKey, properties, nullptr);
        CFRelease(properties);
    }
    CFRelease(url);
#else
    (void)file;
#endif
}

}  // namespace session_bridge
