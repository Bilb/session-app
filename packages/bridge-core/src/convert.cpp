#include "convert.hpp"

#include <session/client/conversation_id.hpp>

#include <algorithm>
#include <chrono>
#include <optional>
#include <utility>
#include <vector>

namespace session::bridge {

std::string to_hex(std::span<const std::byte> bytes) {
    static constexpr char digits[] = "0123456789abcdef";
    std::string hex;
    hex.reserve(bytes.size() * 2);
    for (auto b : bytes) {
        hex += digits[std::to_integer<unsigned>(b) >> 4];
        hex += digits[std::to_integer<unsigned>(b) & 0xf];
    }
    return hex;
}

namespace {

    double epoch_ms(sys_ms t) {
        return static_cast<double>(t.time_since_epoch().count());
    }

    template <typename T>
    std::optional<double> number(const std::optional<T>& value) {
        if (!value)
            return std::nullopt;
        return static_cast<double>(*value);
    }

    std::optional<std::string> non_empty(std::string value) {
        if (value.empty())
            return std::nullopt;
        return std::move(value);
    }

    // The enum values are libsession's own, so each of these is a cast in disguise; written out
    // because a value libsession adds should fail to compile here rather than cross the bridge
    // as a name nothing recognises.
    SendState send_state(client::SendState s) {
        switch (s) {
            case client::SendState::pending: return SendState::pending;
            case client::SendState::sending: return SendState::sending;
            case client::SendState::sent: return SendState::sent;
            case client::SendState::failed: return SendState::failed;
            case client::SendState::interrupted: return SendState::interrupted;
            case client::SendState::uploading: return SendState::uploading;
            case client::SendState::unsendable: return SendState::unsendable;
        }
        return SendState::pending;
    }

    AutoDownload auto_download(client::AutoDownload a) {
        switch (a) {
            case client::AutoDownload::none: return AutoDownload::none;
            case client::AutoDownload::image_attachments: return AutoDownload::image_attachments;
            case client::AutoDownload::all: return AutoDownload::all;
        }
        return AutoDownload::none;
    }

    Deletion deletion(client::Deletion d) {
        return d == client::Deletion::here ? Deletion::here : Deletion::everywhere;
    }

}  // namespace

Attachment to_bridge(const client::Attachment& from) {
    return Attachment(
            static_cast<double>(from.index),
            from.content_type,
            from.filename,
            from.caption,
            number(from.size),
            from.voice_message,
            number(from.width),
            number(from.height),
            from.uploaded);
}

Message to_bridge(const client::Message& from) {
    std::vector<Attachment> attachments;
    attachments.reserve(from.attachments.size());
    for (const auto& a : from.attachments)
        attachments.push_back(to_bridge(a));

    std::optional<Reply> reply;
    if (from.reply) {
        // One level deep: a message reached through a reply carries what it answered but not the
        // answer itself, so the body is absent on a nested reply even when message_id is set.
        std::optional<std::string> body;
        if (from.reply->message)
            body = from.reply->message->body;
        reply = Reply(
                to_hex(from.reply->author),
                epoch_ms(from.reply->timestamp),
                number(from.reply->message_id),
                std::move(body));
    }

    std::optional<Deletion> deleted;
    if (from.deleted)
        deleted = deletion(*from.deleted);

    return Message(
            static_cast<double>(from.id),
            from.conversation.to_string(),
            to_hex(from.sender),
            epoch_ms(from.timestamp),
            from.body,
            from.outgoing,
            // Incoming messages have no send state; every consumer reads it behind `outgoing`,
            // so an absent value would only move the question.
            from.send_state ? send_state(*from.send_state) : SendState::sent,
            std::move(attachments),
            std::move(reply),
            deleted);
}

Conversation to_bridge(const client::AnyConversation& from) {
    ConversationKind kind = ConversationKind::community;
    std::optional<std::string> nickname;
    bool request = false, awaiting_approval = false, note_to_self = false, blocked = false;
    if (const auto* dm = from.dm()) {
        kind = ConversationKind::dm;
        nickname = non_empty(dm->nickname);
        request = dm->request;
        awaiting_approval = dm->awaiting_approval;
        note_to_self = dm->note_to_self;
        blocked = dm->blocked;
    } else if (from.group()) {
        kind = ConversationKind::group;
    }

    const auto mute_ms = std::chrono::duration_cast<std::chrono::milliseconds>(
                                 from.mute_until().time_since_epoch())
                                 .count();

    return Conversation(
            from.id().to_string(),
            kind,
            from.display_name(),
            std::move(nickname),
            epoch_ms(from.last_activity()),
            static_cast<double>(from.priority()),
            static_cast<double>(std::max(0, from.unread())),
            from.marked_unread(),
            non_empty(from.last_message()),
            mute_ms > 0 ? std::optional<double>{static_cast<double>(mute_ms)} : std::nullopt,
            // Unset upstream means "inherit the account default" rather than "none"; the two are
            // not distinguished because no screen offers the distinction.
            from.auto_download() ? auto_download(*from.auto_download()) : AutoDownload::none,
            request,
            awaiting_approval,
            note_to_self,
            blocked);
}

}  // namespace session::bridge
