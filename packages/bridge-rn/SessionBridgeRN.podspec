require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))
repo = File.expand_path("../..", __dir__)

Pod::Spec.new do |s|
  s.name         = "SessionBridgeRN"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.license      = "GPL-3.0-only"
  s.authors      = "Session"
  s.homepage     = "https://getsession.org"
  s.platforms    = { :ios => "15.1" }
  s.source       = { :path => "." }

  # CocoaPods compiles the shim itself here. There is no CMake in an Xcode build, so unlike the
  # Node addon and the Android library — where CMake drives bridge-core — these are listed as
  # sources and Xcode builds them.  The generated wire-format classes come from
  # `pnpm --filter @session/proto codegen:cpp`, which the iOS build script runs.
  s.source_files = [
    "cpp/**/*.{hpp,cpp}",
    "../bridge-core/src/**/*.{hpp,cpp}",
    "../bridge-core/include/**/*.hpp",
    "../proto/gen-cpp/**/*.{h,cc}",
  ]

  # libsession's own xcframework, built by its utils/ios.sh for the same reason Android's comes
  # from utils/android.sh: its dependencies have to be cross-compiled by libsession's build.
  s.vendored_frameworks = "ios/libsession-util.xcframework"

  libsession = "#{repo}/libsession-util"
  router = "#{libsession}/external/session-router"

  # The xcframework carries every dependency's code and none of their headers, and libsession's
  # public headers include several of them — oxenc and oxen/quic in client.hpp alone. The same
  # list bridge-core's CMake spells out for a prebuilt archive.
  headers = [
    "#{__dir__}/cpp",
    "#{repo}/packages/bridge-core/include",
    "#{repo}/packages/proto/gen-cpp",
    "#{libsession}/include",
    "#{libsession}/external/session-sqlite/include",
    "#{libsession}/external/session-sqlite/SQLiteCpp/include",
    "#{libsession}/external/protobuf/src",
    "#{router}/external/oxen-libquic/include",
    "#{router}/external/oxen-mq/oxen-encoding",
    "#{router}/external/oxen-mq/oxen-logging/fmt/include",
    "#{router}/external/oxen-mq/oxen-logging/spdlog/include",
    "#{router}/external/nlohmann/single_include",
    "#{libsession}/build-ios/sim-arm64/static-deps/include",
  ]

  s.pod_target_xcconfig = {
    "CLANG_CXX_LANGUAGE_STANDARD" => "c++20",
    "HEADER_SEARCH_PATHS" => headers.map { |h| "\"#{h}\"" }.join(" "),
    # The generated protobuf classes trip this, exactly as libsession's own protos do.
    "WARNING_CFLAGS" => "$(inherited) -Wno-unused-parameter",
  }

  load File.join(__dir__, "nitrogen/generated/ios/SessionBridgeRN+autolinking.rb")
  add_nitrogen_files(s)

  s.dependency "React-jsi"
  s.dependency "React-callinvoker"
  s.dependency "NitroModules"
end
