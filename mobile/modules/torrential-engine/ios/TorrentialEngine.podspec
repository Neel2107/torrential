Pod::Spec.new do |s|
  s.name           = 'TorrentialEngine'
  s.version        = '0.1.0'
  s.summary        = "torrential's engine, running inside the app"
  s.description    = "torrential's engine built from crates/mobile, started on loopback inside the app"
  s.license        = 'MIT'
  s.author         = 'torrential'
  s.homepage       = 'https://github.com/nexxeln/torrential'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/nexxeln/torrential.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '*.swift'
  # Built by mobile/scripts/build-engine.sh ios.
  s.vendored_frameworks = 'TorrentialMobile.xcframework'
  s.frameworks = 'Security', 'SystemConfiguration', 'CoreFoundation'
  s.libraries = 'c++', 'iconv', 'resolv'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
