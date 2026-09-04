cmake_minimum_required(VERSION 3.20)

project(session-bridge-core
    VERSION 0.0.1
    DESCRIPTION "One libsession Client behind one ordered frame stream"
    LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(NOT TARGET libsession::client)
    # Stand-alone build, for compiling the shim on its own. The addon and the Nitro module
    # add_subdirectory this from a build that has already added libsession.
    set(SESSION_BRIDGE_LIBSESSION "${CMAKE_CURRENT_SOURCE_DIR}/../../libsession-util"
        CACHE PATH "Path to the libsession-util submodule")
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
# LITE_RUNTIME, matching what libsession bundles: see the option in the .proto files.
target_link_libraries(session-bridge-proto PUBLIC protobuf::libprotobuf-lite)
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
    "Compile DeliverTestMessage, which feeds Core a message the way the swarm would" OFF)
if(SESSION_BRIDGE_TESTING)
    target_compile_definitions(session-bridge-core PRIVATE SESSION_BRIDGE_TESTING)
endif()

add_library(session::bridge-core ALIAS session-bridge-core)
