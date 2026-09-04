require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "SessionBridgeRN"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.license      = "GPL-3.0-only"
  s.authors      = "Session"
  s.homepage     = "https://getsession.org"
  s.platforms    = { :ios => "15.1" }
  s.source       = { :path => "." }

  s.source_files = "cpp/**/*.{hpp,cpp}"
  s.pod_target_xcconfig = {
    "CLANG_CXX_LANGUAGE_STANDARD" => "c++20",
    "HEADER_SEARCH_PATHS" => '"$(PODS_TARGET_SRCROOT)/cpp" "$(PODS_TARGET_SRCROOT)/../../libsession-util/include"',
  }

  # Built by utils/ios.sh, for the same reason Android's comes from utils/android.sh: libsession's
  # dependencies have to be cross-compiled by its own build, not by whichever project embeds it.
  s.vendored_frameworks = "ios/libsession-util.xcframework"

  load File.join(__dir__, "nitrogen/generated/ios/SessionBridgeRN+autolinking.rb")
  add_nitrogen_files(s)

  s.dependency "React-jsi"
  s.dependency "React-callinvoker"
  s.dependency "NitroModules"
end
