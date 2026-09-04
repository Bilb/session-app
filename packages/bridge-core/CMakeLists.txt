cmake_minimum_required(VERSION 3.20)

project(session-bridge-core
    VERSION 0.0.1
    DESCRIPTION "One libsession Client behind one ordered frame stream"
    LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

set(SESSION_BRIDGE_LIBSESSION "${CMAKE_CURRENT_SOURCE_DIR}/../../libsession-util"
    CACHE PATH "Path to the libsession-util submodule")

# A prebuilt libsession, for platforms where building it inside the consumer's CMake project is
# not how libsession is built. Android is one: its dependencies are cross-compiled by
# utils/android.sh, which is the only path that gets the NDK toolchain as far as the CMake-based
# ones — build it in-place there and simdutf comes out targeting the host, which shows up as
# libstdc++ symbols missing at link time.
set(SESSION_BRIDGE_LIBSESSION_BUNDLE "" CACHE FILEPATH
    "Prebuilt libsession-util.a from utils/static-bundle.sh; built from source when empty")

if(SESSION_BRIDGE_LIBSESSION_BUNDLE)
    add_library(session-libsession-prebuilt STATIC IMPORTED GLOBAL)
    set_target_properties(session-libsession-prebuilt PROPERTIES
        IMPORTED_LOCATION "${SESSION_BRIDGE_LIBSESSION_BUNDLE}")
    # The bundle carries every dependency's code and none of their headers, and libsession's
    # public headers include several of them — oxenc and oxen/quic in client.hpp alone. Building
    # from source gets these through the targets it links; a prebuilt archive has no targets, so
    # the paths are spelled out.
    set(_ls "${SESSION_BRIDGE_LIBSESSION}")
    set(_router "${_ls}/external/session-router")
    # Dependencies the bundle's own build installed — ngtcp2 and friends — which sit beside it.
    get_filename_component(_bundle_dir "${SESSION_BRIDGE_LIBSESSION_BUNDLE}" DIRECTORY)
    target_include_directories(session-libsession-prebuilt INTERFACE
        "${_ls}/include"
        "${_ls}/external/session-sqlite/include"
        "${_ls}/external/session-sqlite/SQLiteCpp/include"
        "${_ls}/external/protobuf/src"
        "${_router}/external/oxen-libquic/include"
        "${_router}/external/oxen-mq/oxen-encoding"
        "${_router}/external/oxen-mq/oxen-logging/fmt/include"
        "${_router}/external/oxen-mq/oxen-logging/spdlog/include"
        "${_router}/external/nlohmann/single_include"
        "${_bundle_dir}/static-deps/include")
    # STATIC_BUNDLE says "a single static .a containing everything" and does not quite mean it:
    # session-sqlite's own archives are left out, so a consumer linking only the bundle gets
    # undefined session::sqlite::Database and session::secure_buffer. Worth raising upstream;
    # until then they go on the link line beside it.
    set(_extra)
    foreach(lib
            "${_bundle_dir}/external/session-sqlite/libsession_sqlite.a"
            "${_bundle_dir}/external/session-sqlite/libsession_secure_buffer.a"
            "${_bundle_dir}/external/session-sqlite/SQLiteCpp/libSQLiteCpp.a"
            "${_bundle_dir}/static-deps/lib/libsqlite3mc.a"
            "${_bundle_dir}/static-deps/lib/libutf8proc.a")
        if(EXISTS "${lib}")
            list(APPEND _extra "${lib}")
        endif()
    endforeach()
    if(_extra)
        set_property(TARGET session-libsession-prebuilt APPEND PROPERTY
            INTERFACE_LINK_LIBRARIES ${_extra})
    endif()

    add_library(libsession::client ALIAS session-libsession-prebuilt)
    add_library(libsession::protos ALIAS session-libsession-prebuilt)
elseif(NOT TARGET libsession::client)
    # Stand-alone build, for compiling the shim on its own. The addon add_subdirectory's this
    # from a build that has already added libsession.
    add_subdirectory(${SESSION_BRIDGE_LIBSESSION} libsession-util)
endif()

# The wire format is generated here rather than committed, because the only thing that needs the
# C++ classes is a build that already has a C++ toolchain and CMake. Committing them would put a
# pinned protoc on the fast CI path, where a version drift shows up as a codegen:check failure in
# a job that compiles nothing.
# protoc only. The runtime comes from libsession's own bundled protobuf target: asking
# find_package for it as well would define a second protobuf::libprotobuf-lite over the top of
# the one we are linking against.
find_program(SESSION_BRIDGE_PROTOC protoc REQUIRED)

# It has to be the *matching* protoc. Generated protobuf code carries a hard assertion about the
# runtime it was produced for, so a newer compiler does not degrade — it fails somewhere deep
# inside a generated header, with an error that says nothing about versions. Checked here so the
# failure names itself and the fix.
#
# The expected version is read out of the submodule rather than written down, so it cannot drift
# from the pin.
file(READ "${SESSION_BRIDGE_LIBSESSION}/external/protobuf/version.json" _protobuf_version_json)
string(REGEX MATCH "\"cpp\"[ \t]*:[ \t]*\"([0-9]+\\.[0-9]+)" _matched "${_protobuf_version_json}")
set(_protobuf_expected "${CMAKE_MATCH_1}")

execute_process(COMMAND "${SESSION_BRIDGE_PROTOC}" --version
    OUTPUT_VARIABLE _protoc_reported OUTPUT_STRIP_TRAILING_WHITESPACE
    COMMAND_ERROR_IS_FATAL ANY)
string(REGEX MATCH "([0-9]+\\.[0-9]+)" _matched "${_protoc_reported}")
set(_protoc_found "${CMAKE_MATCH_1}")

if(NOT _protoc_found VERSION_EQUAL _protobuf_expected)
    message(FATAL_ERROR
        "protoc ${_protoc_found} cannot generate code for the protobuf runtime libsession "
        "bundles (${_protobuf_expected}).\n"
        "  found: ${SESSION_BRIDGE_PROTOC} (${_protoc_reported})\n"
        "Install a matching one and point at it with -DSESSION_BRIDGE_PROTOC=<path>:\n"
        "  macOS: brew install protobuf@21\n"
        "         -DSESSION_BRIDGE_PROTOC=$(brew --prefix protobuf@21)/bin/protoc\n"
        "  Debian/Ubuntu: protobuf-compiler is 3.21 on trixie and later\n"
        "  otherwise: the release binary from protocolbuffers/protobuf, tag v${_protobuf_expected}.x")
endif()

set(bridge_proto_dir "${CMAKE_CURRENT_SOURCE_DIR}/../proto/proto")
set(bridge_proto_gen "${CMAKE_CURRENT_BINARY_DIR}/gen")
file(MAKE_DIRECTORY "${bridge_proto_gen}")

set(bridge_protos types commands frames)
set(bridge_proto_srcs)
foreach(name IN LISTS bridge_protos)
    set(src "${bridge_proto_gen}/sessionbridge/v1/${name}.pb.cc")
    set(hdr "${bridge_proto_gen}/sessionbridge/v1/${name}.pb.h")
    add_custom_command(
        OUTPUT ${src} ${hdr}
        COMMAND ${SESSION_BRIDGE_PROTOC}
            --proto_path=${bridge_proto_dir}
            --cpp_out=${bridge_proto_gen}
            sessionbridge/v1/${name}.proto
        DEPENDS ${bridge_proto_dir}/sessionbridge/v1/${name}.proto
        COMMENT "protoc sessionbridge/v1/${name}.proto"
        VERBATIM)
    list(APPEND bridge_proto_srcs ${src})
endforeach()

add_library(session-bridge-proto STATIC ${bridge_proto_srcs})
target_include_directories(session-bridge-proto PUBLIC ${bridge_proto_gen})
# Both archives end up inside a shared object — the Node addon is one, and so is the Nitro
# module — so neither may contain non-relocatable code.
set_property(TARGET session-bridge-proto PROPERTY POSITION_INDEPENDENT_CODE ON)
# LITE_RUNTIME, matching what libsession bundles: see the option in the .proto files. A prebuilt
# bundle already contains it, headers and all coming from the imported target above.
if(SESSION_BRIDGE_LIBSESSION_BUNDLE)
    target_link_libraries(session-bridge-proto PUBLIC session-libsession-prebuilt)
else()
    target_link_libraries(session-bridge-proto PUBLIC protobuf::libprotobuf-lite)
endif()
# The generated code trips -Wunused-parameter, exactly as libsession's own protos do.
if(NOT MSVC)
    target_compile_options(session-bridge-proto PRIVATE -Wno-unused-parameter)
endif()

add_library(session-bridge-core STATIC
    src/client_bridge.cpp
    src/encode.cpp)

target_include_directories(session-bridge-core
    PUBLIC ${CMAKE_CURRENT_SOURCE_DIR}/include
    PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/src)

target_link_libraries(session-bridge-core
    PUBLIC libsession::client
    PRIVATE session-bridge-proto)

set_property(TARGET session-bridge-core PROPERTY POSITION_INDEPENDENT_CODE ON)

option(SESSION_BRIDGE_TESTING
    "Compile the test-only commands, which carry messages between clients with no network" OFF)
if(SESSION_BRIDGE_TESTING)
    target_compile_definitions(session-bridge-core PRIVATE SESSION_BRIDGE_TESTING)
    # Forging a DM means building the same Content the wire carries. libsession links its protos
    # privately, so the headers do not arrive with libsession::client.
    target_link_libraries(session-bridge-core PRIVATE libsession::protos)
endif()

add_library(session::bridge-core ALIAS session-bridge-core)
