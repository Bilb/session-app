# iOS

`libsession-util.xcframework` goes here, built by libsession's own `utils/ios.sh`. It is not
committed: it is tens of megabytes of per-architecture static libraries, and it is reproducible
from the submodule pin.

Unbuilt and unverified — this repository's work has been on Linux, where there is no Xcode. The
podspec and the C++ are written and the C++ is the same file Android compiles, but nobody has
run `pod install` against this yet, and the first person to do so should expect to fix something.
