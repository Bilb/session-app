#pragma once

#include <filesystem>
#include <string>
#include <string_view>

namespace session_bridge {

/// A path from the UTF-8 every caller of the bridge speaks. On Windows `path{std::string}` reads
/// the bytes in the ANSI code page instead, which turns any non-ASCII name into another file.
///
/// On Windows, throws `std::invalid_argument` when `utf8` is not valid UTF-8; elsewhere the bytes
/// pass through as they are.
std::filesystem::path utf8_path(std::string_view utf8);

/// The inverse: `path.string()` on Windows encodes to the ANSI code page, and throws for a
/// character outside it.
std::string utf8_string(const std::filesystem::path& path);

}  // namespace session_bridge
