#!/bin/sh
# Forces position-independent code on every C dependency libsession builds from source.
#
# The addon is a shared object, so nothing linked into it may contain absolute relocations.
# libsession's own targets are PIC already; its autotools dependencies get there by way of
# --with-pic in session-deps, except libevent, whose script overrides the shared configure
# command and does not carry that flag over. There is no hook to add one, and session-deps is
# two submodules down, so the flag goes on the compiler instead — which is where it would have
# to go for any other dependency that grows the same gap.
#
# Delete this once session-deps' libevent_core.cmake passes --with-pic like its siblings do.
exec "${SESSION_BRIDGE_CC:-cc}" -fPIC "$@"
