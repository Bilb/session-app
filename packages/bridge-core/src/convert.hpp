#pragma once

#include <session/client/attachment.hpp>
#include <session/client/conversation.hpp>
#include <session/client/message.hpp>

#include <cstddef>
#include <span>
#include <string>

#include "session_bridge/gen/types.hpp"

namespace session_bridge {

/// libsession's value types as the protocol's, one direction only: what comes the other way is a
/// command's arguments, which are read at the point they are used because each one validates
/// differently.
///
/// Spelled out rather than reached through an enclosing namespace: this namespace is flat, so
/// nothing of libsession's is in scope unless a file says so.
Attachment to_bridge(const ::session::client::Attachment& from);
Message to_bridge(const ::session::client::Message& from);
Conversation to_bridge(const ::session::client::AnyConversation& from);

std::string to_hex(std::span<const std::byte> bytes);

}  // namespace session_bridge
