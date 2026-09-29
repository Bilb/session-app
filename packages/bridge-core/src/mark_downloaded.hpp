#pragma once

#include <filesystem>

namespace session_bridge {

/// Marks a file written out of an attachment as having come from the internet, as a browser marks
/// a download: Mark-of-the-Web on Windows, which SmartScreen reads before running it, and the
/// quarantine attribute on macOS, which Gatekeeper reads on first open.
///
/// Best effort and silent: a volume that cannot hold the mark still gets the file. Nothing
/// elsewhere, which has no such mark for anything to read.
void mark_downloaded(const std::filesystem::path& file) noexcept;

}  // namespace session_bridge
