#pragma once

#include <session/client/attachment.hpp>
#include <session/client/conversation.hpp>
#include <session/client/message.hpp>

#include <cstddef>
#include <span>
#include <string>

#include "session_bridge/gen/types.hpp"

namespace session::bridge {

/// libsession's value types as the protocol's, one direction only: what comes the other way is a
/// command's arguments, which are read at the point they are used because each one validates
/// differently.
Attachment to_bridge(const client::Attachment& from);
Message to_bridge(const client::Message& from);
Conversation to_bridge(const client::AnyConversation& from);

std::string to_hex(std::span<const std::byte> bytes);

}  // namespace session::bridge
