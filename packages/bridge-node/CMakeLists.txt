cmake_minimum_required(VERSION 3.20)

project(session_bridge_node CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release CACHE STRING "" FORCE)
endif()

# Built by cmake-js, which supplies CMAKE_JS_INC / CMAKE_JS_SRC / CMAKE_JS_LIB.
add_subdirectory(../bridge-core bridge-core)

execute_process(
    COMMAND node -p "require('node-addon-api').include_dir"
    WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
    OUTPUT_VARIABLE NODE_ADDON_API_DIR
    OUTPUT_STRIP_TRAILING_WHITESPACE
    COMMAND_ERROR_IS_FATAL ANY)

add_library(${PROJECT_NAME} SHARED src/addon.cpp ${CMAKE_JS_SRC})
set_target_properties(${PROJECT_NAME} PROPERTIES PREFIX "" SUFFIX ".node")

target_include_directories(${PROJECT_NAME} PRIVATE ${CMAKE_JS_INC} ${NODE_ADDON_API_DIR})
target_link_libraries(${PROJECT_NAME} PRIVATE ${CMAKE_JS_LIB} session::bridge-core)

session_bridge_strict_switches(${PROJECT_NAME})

# N-API 8 is the floor: it is what makes one build load in both Node and Electron, which is the
# whole reason this is an N-API addon rather than a NAN one.
target_compile_definitions(${PROJECT_NAME} PRIVATE NAPI_VERSION=8)

# Only the N-API entry points leave the addon. On Linux, Electron has already loaded the system's
# gnutls and nettle, and an exported copy of ours binds to those instead, built against other
# headers. On macOS, dyld coalesces exported weak definitions across every image in the process.
if(CMAKE_SYSTEM_NAME STREQUAL "Linux")
    target_link_options(${PROJECT_NAME} PRIVATE
        "LINKER:--version-script=${CMAKE_CURRENT_SOURCE_DIR}/exports.map")
    set_property(TARGET ${PROJECT_NAME} APPEND PROPERTY LINK_DEPENDS
        ${CMAKE_CURRENT_SOURCE_DIR}/exports.map)
elseif(APPLE)
    target_link_options(${PROJECT_NAME} PRIVATE
        "LINKER:-exported_symbol,_napi_register_module_v1"
        "LINKER:-exported_symbol,_node_api_module_get_api_version_v1")
endif()

if(MSVC AND CMAKE_JS_NODELIB_DEF AND CMAKE_JS_NODELIB_TARGET)
    execute_process(COMMAND ${CMAKE_AR} /def:${CMAKE_JS_NODELIB_DEF}
        /out:${CMAKE_JS_NODELIB_TARGET} ${CMAKE_STATIC_LINKER_FLAGS})
endif()
