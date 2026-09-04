#pragma once

#include <session/client/attachment.hpp>
#include <session/client/conversation.hpp>
#include <session/client/message.hpp>
#include <string>

#include "sessionbridge/v1/types.pb.h"

/// libsession's value types, written into the wire types.
///
/// One direction only: what comes the other way is a command's arguments, which are parsed at the
/// point they are used because each one validates differently.
namespace session::bridge {

std::string to_hex(std::span<const std::byte> bytes);

void encode(const client::Attachment& from, sessionbridge::v1::Attachment* to);
void encode(const client::Message& from, sessionbridge::v1::Message* to);
void encode(const client::AnyConversation& from, sessionbridge::v1::Conversation* to);

}  // namespace session::bridge
