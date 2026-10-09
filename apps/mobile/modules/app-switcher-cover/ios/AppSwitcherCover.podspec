Pod::Spec.new do |s|
  s.name           = "AppSwitcherCover"
  s.version        = "0.0.0"
  s.summary        = "Covers the app with its launch screen while it is not active"
  s.license        = "GPL-3.0-only"
  s.authors        = "Session"
  s.homepage       = "https://getsession.org"
  s.platforms      = { :ios => "15.1" }
  s.swift_version  = "5.9"
  s.source         = { :path => "." }
  s.static_framework = true

  s.dependency "ExpoModulesCore"

  s.source_files = "*.swift"
  s.pod_target_xcconfig = { "DEFINES_MODULE" => "YES" }
end
