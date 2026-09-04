#include "session_bridge/client_bridge.hpp"

#include <session/client.hpp>
#include <session/client/conversation.hpp>
#include <session/client/conversation_id.hpp>
#include <session/core/devices.hpp>
#include <session/mnemonics.hpp>
#include <session/network/network_opt.hpp>
#include <session/network/session_network.hpp>
#include <session/sqlite.hpp>

#include <oxenc/hex.h>

#ifdef SESSION_BRIDGE_TESTING
#include <SessionProtos.pb.h>

#include <session/config/namespaces.hpp>
#include <session/core/swarm_message.hpp>
#include <session/session_protocol.hpp>
#endif

#include <cstring>
#include <ranges>
#include <stdexcept>
#include <utility>
#include <vector>

#include "encode.hpp"
#include "sessionbridge/v1/commands.pb.h"
#include "sessionbridge/v1/frames.pb.h"

namespace session::bridge {

namespace pb = sessionbridge::v1;

namespace {

    /// libsession reports "no such thing" as an empty optional rather than an error, and the two
    /// mean different things to a caller. Said once here so every command spells it the same way.
    std::string not_found(std::string_view what, const std::string& id) {
        return std::string{what} + " " + id + " does not exist";
    }

}  // namespace

struct ClientBridge::Impl {
    Sink sink;
    std::unique_ptr<client::Client> client;
    InitOptions options;

    explicit Impl(Sink s, InitOptions o) : sink{std::move(s)}, options{std::move(o)} {}

    /// What this client tells the account's other devices it is.
    ///
    /// Called on every start rather than once: `update_info` compares the user-settable fields
    /// itself and returns without touching the seqno when they match. Which does mean it has to
    /// be built from things that do not vary between launches — anything read from the clock or
    /// the environment would republish this device to the account on every run.
    void publish_device_info() {
        using core::device::Type;
        auto type = options.device_type == "ios"       ? Type::Session_iOS
                    : options.device_type == "android" ? Type::Session_Android
                    : options.device_type == "desktop" ? Type::Session_Desktop
                                                       : Type::Unknown;
        if (type == Type::Unknown)
            return;

        auto info = client->core.devices.device_info().first;
        info.type = type;
        // Ignored for a known type, but it is what we would have been stored as before that type
        // existed, and leaving it set keeps a stale string in the record.
        info.other_device.clear();
        client->core.devices.update_info(info);
    }

    /// Gives Core a way off the machine. Idempotent enough to call whenever an account appears:
    /// make_network replaces whatever was attached.
    void attach_network() {
        if (options.netid.empty() || !client->core.globals.have_account())
            return;

        namespace net = session::network;

        // devnet takes seed nodes, and a seed node is a public key, an address and two ports —
        // not something a URL can be turned into here. Wiring it means deciding how the app is
        // told those, which is a devnet question rather than a bridge one, so it refuses rather
        // than quietly attaching to mainnet instead.
        if (options.netid == "devnet")
            throw std::invalid_argument{"devnet is not wired up: it needs seed node details"};
        if (options.netid != "mainnet" && options.netid != "testnet")
            throw std::invalid_argument{"netid must be mainnet or testnet"};

        auto netid = options.netid == "testnet" ? net::opt::netid::testnet()
                                                : net::opt::netid::mainnet();

        // Beside the database rather than in it: freeing space works by unlinking what the
        // directory holds that nothing accounts for, so this cannot share with anything else.
        auto cache = options.db_path.parent_path() / "netcache";

        client->core.make_network(
                std::move(netid),
                net::opt::router::session_router(),
                net::opt::cache_directory{cache});
    }

    /// Both halves of "an account now exists", which is what onboarding signals too. The record
    /// is published whether or not there is a network to push it over, since being offline stops
    /// the push rather than the fact.
    void on_account() {
        publish_device_info();
        attach_network();
    }

    /// The only path frames take out of here. Serialising into a reused buffer would be a false
    /// economy: the sink is called from Core's loop and may be called again before the adapter has
    /// drained the last one.
    void emit(const pb::Frame& frame) {
        if (!sink)
            return;
        std::string bytes;
        if (!frame.SerializeToString(&bytes))
            return;
        sink(std::as_bytes(std::span{bytes.data(), bytes.size()}));
    }

    void emit(pb::Event&& event) {
        pb::Frame frame;
        *frame.mutable_event() = std::move(event);
        emit(frame);
    }

    void emit(pb::Response&& response) {
        pb::Frame frame;
        *frame.mutable_response() = std::move(response);
        emit(frame);
    }

    void ok(uint32_t id) {
        pb::Response r;
        r.set_request_id(id);
        r.mutable_empty();
        emit(std::move(r));
    }

    void fail(uint32_t id, std::string_view message) {
        pb::Response r;
        r.set_request_id(id);
        r.set_error(std::string{message});
        emit(std::move(r));
    }

    /// Wraps a handler so that the error leg is written once rather than at every call site.
    /// `failable_function`'s leading error argument is the whole convention, and forgetting to
    /// check it is the one mistake it exists to prevent.
    template <typename F>
    auto on(uint32_t id, F&& f) {
        return [this, id, f = std::forward<F>(f)](std::optional<std::string> error, auto&&... rest) {
            if (error)
                fail(id, *error);
            else
                f(std::forward<decltype(rest)>(rest)...);
        };
    }

    void conversation_list(uint32_t id, const std::vector<client::AnyConversation>& convos) {
        pb::Response r;
        r.set_request_id(id);
        auto* list = r.mutable_conversation_list();
        for (const auto& c : convos)
            encode(c, list->add_conversations());
        emit(std::move(r));
    }

    void one_conversation(uint32_t id, const client::AnyConversation& convo) {
        pb::Response r;
        r.set_request_id(id);
        encode(convo, r.mutable_conversation()->mutable_conversation());
        emit(std::move(r));
    }

    client::Conversation convo(const std::string& id) {
        return client::Conversation{*client, client::ConversationId::parse(id)};
    }

    void dispatch(const pb::Request& request);
};

ClientBridge::ClientBridge(InitOptions options, Sink sink) :
        _impl{std::make_unique<Impl>(std::move(sink), options)} {

    auto* impl = _impl.get();

    // Every handler does the same two things and nothing else: encode, and hand to the sink. That
    // is what makes running them inline on Core's loop correct rather than merely convenient.
    client::callbacks cbs{
            .conversation_added =
                    [impl](const client::AnyConversation& c) {
                        pb::Event e;
                        encode(c, e.mutable_conversation_added()->mutable_conversation());
                        impl->emit(std::move(e));
                    },
            .conversation_updated =
                    [impl](const client::AnyConversation& c) {
                        pb::Event e;
                        encode(c, e.mutable_conversation_updated()->mutable_conversation());
                        impl->emit(std::move(e));
                    },
            .conversation_removed =
                    [impl](const client::ConversationId& id) {
                        pb::Event e;
                        e.mutable_conversation_removed()->set_conversation_id(id.to_string());
                        impl->emit(std::move(e));
                    },
            .conversation_list_replaced =
                    [impl](std::vector<client::AnyConversation> convos) {
                        pb::Event e;
                        auto* list = e.mutable_conversation_list_replaced();
                        for (const auto& c : convos)
                            encode(c, list->add_conversations());
                        impl->emit(std::move(e));
                    },
            .request_list_replaced =
                    [impl](std::vector<client::AnyConversation> convos) {
                        pb::Event e;
                        auto* list = e.mutable_request_list_replaced();
                        for (const auto& c : convos)
                            encode(c, list->add_conversations());
                        impl->emit(std::move(e));
                    },
            .message_added =
                    [impl](const client::ConversationId& id, const client::Message& m) {
                        pb::Event e;
                        auto* added = e.mutable_message_added();
                        added->set_conversation_id(id.to_string());
                        encode(m, added->mutable_message());
                        impl->emit(std::move(e));
                    },
            .message_updated =
                    [impl](const client::ConversationId& id, const client::Message& m) {
                        pb::Event e;
                        auto* updated = e.mutable_message_updated();
                        updated->set_conversation_id(id.to_string());
                        encode(m, updated->mutable_message());
                        impl->emit(std::move(e));
                    },
            .history_replaced =
                    [impl](const client::ConversationId& id) {
                        pb::Event e;
                        e.mutable_history_replaced()->set_conversation_id(id.to_string());
                        impl->emit(std::move(e));
                    },
            .attachment_progress =
                    [impl](const client::ConversationId& id, const client::AttachmentProgress& p) {
                        pb::Event e;
                        auto* progress = e.mutable_attachment_progress();
                        // Only background fetches come through here; a transfer the app asked for
                        // reports to that request instead, which is what request_id distinguishes.
                        progress->set_conversation_id(id.to_string());
                        progress->set_message_id(p.message_id);
                        progress->set_index(static_cast<uint32_t>(p.index));
                        progress->set_done(p.done);
                        progress->set_total(p.total);
                        if (p.result)
                            progress->set_result(*p.result);
                        impl->emit(std::move(e));
                    },
            .display_picture_progress =
                    [impl](const client::ConversationId& id,
                           int64_t done,
                           int64_t total,
                           std::optional<int> result) {
                        pb::Event e;
                        auto* progress = e.mutable_display_picture_progress();
                        progress->set_conversation_id(id.to_string());
                        progress->set_done(done);
                        progress->set_total(total);
                        if (result)
                            progress->set_result(*result);
                        impl->emit(std::move(e));
                    },
    };

    // The key options are types rather than values, so which one is used has to be a branch
    // rather than an argument. Only one of these ever runs, which is what makes moving the
    // callbacks in each of them safe.
    auto open = [&](auto&&... key) {
        if (options.defer_account)
            return std::make_unique<client::Client>(
                    options.db_path,
                    std::move(cbs),
                    core::defer_account{},
                    std::forward<decltype(key)>(key)...);
        return std::make_unique<client::Client>(
                options.db_path, std::move(cbs), std::forward<decltype(key)>(key)...);
    };

    if (options.raw_key)
        _impl->client = open(sqlite::raw_key{*options.raw_key});
    else if (options.password)
        _impl->client = open(sqlite::argon2id_password{*options.password});
    else
        _impl->client = open();

    if (!options.cache_dir.empty())
        _impl->client->set_cache_dir(options.cache_dir);

    // An account that is already there needs no onboarding, so this is where its network comes
    // from. A deferred one gets it from createAccount or restoreAccount instead.
    _impl->on_account();
}

ClientBridge::~ClientBridge() {
    close();
}

void ClientBridge::close() {
    if (!_impl)
        return;
    // Order matters: stop delivering before destroying, or a callback fired during teardown
    // reaches a sink the adapter has already torn down.
    _impl->sink = nullptr;
    _impl->client.reset();
}

void ClientBridge::call(std::span<const std::byte> request_bytes) {
    if (!_impl || !_impl->client)
        return;

    pb::Request request;
    if (!request.ParseFromArray(request_bytes.data(), static_cast<int>(request_bytes.size()))) {
        // No id to answer with — the frame that carried it is what failed to parse.
        return;
    }

    try {
        _impl->dispatch(request);
    } catch (const std::exception& e) {
        // Validation throws on the calling thread: ConversationId::parse on a malformed id, a
        // reply_to naming a message in another conversation. Those are answers to this request,
        // not bridge failures.
        _impl->fail(request.id(), e.what());
    }
}

void ClientBridge::Impl::dispatch(const pb::Request& request) {
    const uint32_t id = request.id();

    switch (request.cmd_case()) {

        case pb::Request::kGetAccountInfo: {
            // The first call the app makes, and on a fresh install there is no account: asking
            // for a display name then is asking a question about an account that does not exist.
            if (!client->core.globals.have_account()) {
                pb::Response r;
                r.set_request_id(id);
                auto* info = r.mutable_account_info();
                info->set_have_account(false);
                info->set_network_attached(false);
                emit(std::move(r));
                return;
            }
            client->display_name(on(id, [this, id](std::string name) {
                pb::Response r;
                r.set_request_id(id);
                auto* info = r.mutable_account_info();
                info->set_have_account(true);
                info->set_session_id(client->core.globals.session_id_hex());
                if (!name.empty())
                    info->set_display_name(name);
                info->set_network_attached(client->core.network() != nullptr);
                emit(std::move(r));
            }));
            return;
        }

        case pb::Request::kCreateAccount:
            client->core.globals.create_account();
            on_account();
            ok(id);
            return;

        case pb::Request::kSetDisplayName:
            client->set_display_name(request.set_display_name().name(), on(id, [this, id] {
                                         ok(id);
                                     }));
            return;

        case pb::Request::kRestoreAccount: {
            const auto& cmd = request.restore_account();
            if (cmd.has_hex_seed()) {
                auto raw = oxenc::from_hex(cmd.hex_seed());
                if (raw.size() != 32)
                    throw std::invalid_argument{"hex_seed must be 32 bytes of hex"};
                b32 seed;
                std::memcpy(seed.data(), raw.data(), seed.size());
                client->core.globals.restore_account(core::predefined_seed{std::span{seed}});
            } else if (cmd.has_words()) {
                const auto& from = cmd.words();
                std::vector<std::string_view> words;
                words.reserve(static_cast<size_t>(from.words_size()));
                for (const auto& word : from.words())
                    words.emplace_back(word);
                const auto& language = from.language();
                client->core.globals.restore_account(
                        language.empty() ? core::predefined_seed{words}
                                         : core::predefined_seed{words, language});
            } else {
                throw std::invalid_argument{"restoreAccount needs words or a hex seed"};
            }
            on_account();
            ok(id);
            return;
        }

        case pb::Request::kGetSeedMnemonic: {
            const auto& language = request.get_seed_mnemonic().language();
            auto words = client->core.globals.seed_mnemonic(
                    language.empty() ? std::string_view{"English"} : std::string_view{language});
            pb::Response r;
            r.set_request_id(id);
            auto* mnemonic = r.mutable_mnemonic();
            // The span must outlive the loop: it holds the accessor that keeps the secure buffer
            // unlocked, and iterating over a temporary re-locks it before the body runs.
            auto opened = words.open();
            for (const auto& word : opened)
                mnemonic->add_words(std::string{word});
            emit(std::move(r));
            return;
        }

        case pb::Request::kGetConversations:
            client->conversations(on(id, [this, id](std::vector<client::AnyConversation> convos) {
                conversation_list(id, convos);
            }));
            return;

        case pb::Request::kGetMessageRequests:
            client->message_requests(
                    on(id, [this, id](std::vector<client::AnyConversation> convos) {
                        conversation_list(id, convos);
                    }));
            return;

        case pb::Request::kGetConversation: {
            const auto& convo_id = request.get_conversation().conversation_id();
            client->conversation(
                    client::ConversationId::parse(convo_id),
                    on(id,
                       [this, id, convo_id](std::optional<client::AnyConversation> convo) {
                           if (!convo)
                               fail(id, not_found("conversation", convo_id));
                           else
                               one_conversation(id, *convo);
                       }));
            return;
        }

        case pb::Request::kOpenDm: {
            const auto& session_id = request.open_dm().session_id();
            client->open_dm(
                    client::ConversationId::parse(session_id),
                    on(id, [this, id, session_id](std::optional<client::DM> dm) {
                        if (!dm)
                            fail(id, not_found("account", session_id));
                        else
                            one_conversation(id, client::AnyConversation{*dm});
                    }));
            return;
        }

        case pb::Request::kMarkRead: {
            const auto& cmd = request.mark_read();
            std::optional<sys_ms> up_to;
            if (cmd.has_up_to())
                up_to = from_epoch_ms(cmd.up_to());
            convo(cmd.conversation_id()).mark_read(up_to, on(id, [this, id] { ok(id); }));
            return;
        }

        case pb::Request::kSetBlocked: {
            const auto& cmd = request.set_blocked();
            client->set_blocked(
                    client::ConversationId::parse(cmd.conversation_id()),
                    cmd.blocked(),
                    on(id, [this, id] { ok(id); }));
            return;
        }

        case pb::Request::kSetPriority: {
            const auto& cmd = request.set_priority();
            convo(cmd.conversation_id())
                    .set_priority(cmd.priority(), on(id, [this, id] { ok(id); }));
            return;
        }

        case pb::Request::kSetNickname: {
            const auto& cmd = request.set_nickname();
            const auto convo_id = cmd.conversation_id();
            const auto nickname = cmd.nickname();
            client->dm(
                    client::ConversationId::parse(convo_id),
                    on(id, [this, id, convo_id, nickname](std::optional<client::DM> dm) {
                        if (!dm)
                            fail(id, not_found("conversation", convo_id));
                        else
                            dm->set_nickname(nickname, on(id, [this, id] { ok(id); }));
                    }));
            return;
        }

        case pb::Request::kDeleteConversation: {
            const auto& cmd = request.delete_conversation();
            convo(cmd.conversation_id())
                    .delete_conversation(cmd.keep_messages(), on(id, [this, id] { ok(id); }));
            return;
        }

        case pb::Request::kGetMessages: {
            const auto& cmd = request.get_messages();
            std::optional<client::MessageCursor> before;
            if (cmd.has_before())
                before = client::MessageCursor{
                        from_epoch_ms(cmd.before().timestamp()), cmd.before().id()};
            convo(cmd.conversation_id())
                    .messages(
                            static_cast<int>(cmd.limit()),
                            before,
                            on(id,
                               [this, id](std::vector<client::Message> messages) {
                                   pb::Response r;
                                   r.set_request_id(id);
                                   auto* list = r.mutable_message_list();
                                   // libsession answers newest first, because that is the
                                   // direction paging runs. The wire is oldest first, because
                                   // that is the direction a transcript is read, and reversing
                                   // once here is cheaper than every caller remembering to.
                                   for (const auto& m : std::views::reverse(messages))
                                       encode(m, list->add_messages());
                                   emit(std::move(r));
                               }));
            return;
        }

        case pb::Request::kSendMessage: {
            const auto& cmd = request.send_message();
            client::OutgoingMessage msg;
            msg.body = cmd.body();
            if (cmd.has_reply_to())
                msg.reply_to = cmd.reply_to();
            for (const auto& a : cmd.attachments()) {
                client::OutgoingAttachment out;
                out.path = a.path();
                if (a.has_content_type())
                    out.content_type = a.content_type();
                if (a.has_filename())
                    out.filename = a.filename();
                if (a.has_caption())
                    out.caption = a.caption();
                out.voice_message = a.voice_message();
                if (a.has_width())
                    out.width = a.width();
                if (a.has_height())
                    out.height = a.height();
                msg.attachments.push_back(std::move(out));
            }
            convo(cmd.conversation_id())
                    .send_message(std::move(msg), on(id, [this, id](int64_t message_id) {
                                      pb::Response r;
                                      r.set_request_id(id);
                                      r.mutable_message_id()->set_message_id(message_id);
                                      emit(std::move(r));
                                  }));
            return;
        }

        case pb::Request::kRetrySend: {
            const int64_t message_id = request.retry_send().message_id();
            // A retry re-uploads whatever did not get through, and reports it the way the original
            // send did. There is no overload without a progress handler, and a retry is where a
            // file that has since been deleted is discovered, so this is not a formality.
            client->retry_send(
                    message_id,
                    [this, id, message_id](
                            size_t index, int64_t sent, int64_t total, std::optional<int> result) {
                        pb::Event e;
                        auto* progress = e.mutable_attachment_progress();
                        progress->set_request_id(id);
                        progress->set_message_id(message_id);
                        progress->set_index(static_cast<uint32_t>(index));
                        progress->set_done(sent);
                        progress->set_total(total);
                        if (result)
                            progress->set_result(*result);
                        emit(std::move(e));
                    },
                    on(id, [this, id](bool started) {
                        pb::Response r;
                        r.set_request_id(id);
                        r.mutable_bool_()->set_value(started);
                        emit(std::move(r));
                    }));
            return;
        }

        case pb::Request::kDeleteMessage: {
            const auto& cmd = request.delete_message();
            auto answer = on(id, [this, id](bool deleted) {
                pb::Response r;
                r.set_request_id(id);
                r.mutable_bool_()->set_value(deleted);
                emit(std::move(r));
            });
            if (cmd.scope() == pb::DELETION_EVERYWHERE)
                client->delete_message_everywhere(cmd.message_id(), std::move(answer));
            else
                client->delete_message(cmd.message_id(), std::move(answer));
            return;
        }

        case pb::Request::kGetPref: {
            auto value = client->core.globals.get_text(request.get_pref().key());
            pb::Response r;
            r.set_request_id(id);
            auto* pref = r.mutable_pref();
            if (value)
                pref->set_value(*value);
            emit(std::move(r));
            return;
        }

        case pb::Request::kSetPref:
            client->core.globals.set(request.set_pref().key(), request.set_pref().value());
            ok(id);
            return;

        case pb::Request::kApproveConversation:
            // There is no such call, by design: libsession records approval from messages
            // flowing, and writing to someone is what approves them (see DM::request). A
            // conversation-layer way to accept a request without answering it is one of the
            // open questions in docs/STATUS.md.
            fail(id,
                 "approveConversation has no libsession counterpart: approval is recorded by "
                 "sending, not set");
            return;

#ifdef SESSION_BRIDGE_TESTING

        case pb::Request::kGetTestAccountSeed: {
            // Named, because the accessor is what holds the secure buffer readable and the
            // rvalue overloads are deleted precisely to stop this being a one-liner.
            auto access = client->core.globals.account_seed();
            auto raw = access.seed();
            pb::Response r;
            r.set_request_id(id);
            r.mutable_bytes()->set_data(reinterpret_cast<const char*>(raw.data()), raw.size());
            emit(std::move(r));
            return;
        }

        case pb::Request::kDeliverTestMessage: {
            const auto& cmd = request.deliver_test_message();
            auto seed = oxenc::from_hex(cmd.sender_seed());
            if (seed.size() != 32)
                throw std::invalid_argument{"sender_seed must be 32 bytes of hex"};

            const auto sent = from_epoch_ms(cmd.timestamp());

            SessionProtos::Content content;
            content.set_sigtimestamp(static_cast<uint64_t>(cmd.timestamp()));
            content.mutable_datamessage()->set_body(cmd.body());
            auto plaintext = content.SerializeAsString();

            b33 recipient;
            std::ranges::copy(client->core.globals.session_id(), recipient.begin());

            auto encoded = encode_dm_v1(
                    std::as_bytes(std::span{plaintext}),
                    ed25519::PrivKeySpan::from(std::as_bytes(std::span{seed})),
                    sent,
                    recipient);

            // The hash is the swarm's, and a redelivered one is how libsession recognises a
            // duplicate — so it has to be stable for a message and different between messages.
            core::SwarmMessage message{
                    encoded,
                    "test-" + std::to_string(cmd.timestamp()) + "-" +
                            std::to_string(std::hash<std::string>{}(cmd.body())),
                    sent,
                    from_epoch_ms(cmd.timestamp() + 14 * 24 * 60 * 60 * 1000)};

            // Onto Core's loop, because the connection pool is single-threaded by design and
            // this is the one place the bridge writes the database from outside it.
            client->core.loop().call_get([&] {
                client->core.receive_messages({&message, 1}, config::Namespace::Default, true);
                return 0;
            });
            ok(id);
            return;
        }

        case pb::Request::kApproveTestContact: {
            auto decoded = oxenc::from_hex(request.approve_test_contact().session_id());
            if (decoded.size() != 33)
                throw std::invalid_argument{"session_id must be 33 bytes of hex"};
            b33 sid;
            std::memcpy(sid.data(), decoded.data(), sid.size());
            client->core.loop().call_get([&] {
                auto conn = client->core.database().conn();
                conn.prepared_exec(
                        "INSERT OR IGNORE INTO accounts (session_id) VALUES (?)", sid);
                conn.prepared_exec(
                        "INSERT INTO contacts (account, approved) VALUES ("
                        "(SELECT id FROM accounts WHERE session_id = ?), 1) "
                        "ON CONFLICT (account) DO UPDATE SET approved = 1",
                        sid);
                return 0;
            });
            ok(id);
            return;
        }

#endif

        case pb::Request::kAttachNetwork: {
            options.netid = request.attach_network().netid();
            attach_network();
            ok(id);
            return;
        }

        case pb::Request::kPollOnce:
            // Core owns its poll ticker and exposes no one-shot entry point. Asking for one is
            // the first of the background-and-push questions in docs/STATUS.md; until it is
            // answered there is nothing honest to call here.
            fail(id, "pollOnce is not supported by this libsession build");
            return;

        default:
            fail(id, "the bridge does not implement this command yet");
            return;
    }
}

}  // namespace session::bridge
