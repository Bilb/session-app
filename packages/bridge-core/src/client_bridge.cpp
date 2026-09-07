#include "session_bridge/client_bridge.hpp"

#include <session/client.hpp>
#include <session/client/conversation.hpp>
#include <session/client/conversation_id.hpp>
#include <session/core/devices.hpp>
#include <session/logging.hpp>
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
#include <variant>
#include <vector>

#include "convert.hpp"

namespace session::bridge {

namespace {

    /// libsession reports "no such thing" as an empty optional rather than an error, and the two
    /// mean different things to a caller. Said once here so every command spells it the same way.
    std::string not_found(std::string_view what, const std::string& id) {
        return std::string{what} + " " + id + " does not exist";
    }

    int64_t whole(double value) {
        return static_cast<int64_t>(value);
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
    /// be built from things that do not vary between launches - anything read from the clock or
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

        // devnet takes seed nodes, and a seed node is a public key, an address and two ports -
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

    /// The only path frames take out of here. Moved, never copied: the adapter's queue takes
    /// ownership on Core's loop and the JavaScript object is built from it on the JS thread.
    void emit(Frame frame) {
        if (!sink)
            return;
        sink(std::move(frame));
    }

    void event(BridgeEvent e) {
        emit(EventFrame{std::move(e)});
    }

    void respond(double id, Result result) {
        emit(ResponseFrame{Response{id, std::nullopt, std::move(result)}});
    }

    void ok(double id) {
        respond(id, EmptyResult{});
    }

    void fail(double id, std::string_view message) {
        emit(ResponseFrame{Response{id, std::string{message}, std::nullopt}});
    }

    /// Wraps a handler so that the error leg is written once rather than at every call site.
    /// `failable_function`'s leading error argument is the whole convention, and forgetting to
    /// check it is the one mistake it exists to prevent.
    template <typename F>
    auto on(double id, F&& f) {
        return [this, id, f = std::forward<F>(f)](std::optional<std::string> error, auto&&... rest) {
            if (error)
                fail(id, *error);
            else
                f(std::forward<decltype(rest)>(rest)...);
        };
    }

    static std::vector<Conversation> conversations(const std::vector<client::AnyConversation>& from) {
        std::vector<Conversation> out;
        out.reserve(from.size());
        for (const auto& c : from)
            out.push_back(to_bridge(c));
        return out;
    }

    void conversation_list(double id, const std::vector<client::AnyConversation>& convos) {
        respond(id, ConversationListResult{conversations(convos)});
    }

    void one_conversation(double id, const client::AnyConversation& convo) {
        respond(id, ConversationResult{to_bridge(convo)});
    }

    client::Conversation convo(const std::string& id) {
        return client::Conversation{*client, client::ConversationId::parse(id)};
    }

    void attachment_progress(
            std::optional<double> request_id,
            std::optional<std::string> conversation_id,
            int64_t message_id,
            size_t index,
            int64_t done,
            int64_t total,
            std::optional<int> result) {
        std::optional<double> outcome;
        if (result)
            outcome = static_cast<double>(*result);
        event(AttachmentProgressBridgeEvent{
                request_id,
                std::move(conversation_id),
                AttachmentProgress{
                        static_cast<double>(message_id),
                        static_cast<double>(index),
                        static_cast<double>(done),
                        static_cast<double>(total),
                        outcome}});
    }

    // One handler per command. Dispatch is a std::visit over the Command variant, so a command
    // added to @session/bridge-types that has no handler here is a compile error, not a request
    // that quietly falls through.

    void handle(double id, const GetAccountInfoCommand&) {
        // The first call the app makes, and on a fresh install there is no account: asking for a
        // display name then is asking a question about an account that does not exist.
        if (!client->core.globals.have_account()) {
            respond(id, AccountInfoResult{AccountInfo{false, std::nullopt, std::nullopt, false}});
            return;
        }
        client->display_name(on(id, [this, id](std::string name) {
            std::optional<std::string> display_name;
            if (!name.empty())
                display_name = std::move(name);
            respond(id,
                    AccountInfoResult{AccountInfo{
                            true,
                            client->core.globals.session_id_hex(),
                            std::move(display_name),
                            client->core.network() != nullptr}});
        }));
    }

    void handle(double id, const CreateAccountCommand&) {
        client->core.globals.create_account();
        on_account();
        ok(id);
    }

    void handle(double id, const SetDisplayNameCommand& cmd) {
        client->set_display_name(cmd.name, on(id, [this, id] { ok(id); }));
    }

    void handle(double id, const RestoreAccountFromSeedCommand& cmd) {
        auto raw = oxenc::from_hex(cmd.hex_seed);
        if (raw.size() != 32)
            throw std::invalid_argument{"hexSeed must be 32 bytes of hex"};
        b32 seed;
        std::memcpy(seed.data(), raw.data(), seed.size());
        client->core.globals.restore_account(core::predefined_seed{std::span{seed}});
        on_account();
        ok(id);
    }

    void handle(double id, const RestoreAccountFromWordsCommand& cmd) {
        std::vector<std::string_view> words;
        words.reserve(cmd.words.size());
        for (const auto& word : cmd.words)
            words.emplace_back(word);
        client->core.globals.restore_account(
                cmd.language ? core::predefined_seed{words, *cmd.language}
                             : core::predefined_seed{words});
        on_account();
        ok(id);
    }

    void handle(double id, const GetSeedMnemonicCommand& cmd) {
        auto words = client->core.globals.seed_mnemonic(
                cmd.language ? std::string_view{*cmd.language} : std::string_view{"English"});
        std::vector<std::string> out;
        // The span must outlive the loop: it holds the accessor that keeps the secure buffer
        // unlocked, and iterating over a temporary re-locks it before the body runs.
        auto opened = words.open();
        for (const auto& word : opened)
            out.emplace_back(word);
        respond(id, MnemonicResult{std::move(out)});
    }

    void handle(double id, const AttachNetworkCommand& cmd) {
        options.netid = cmd.netid;
        attach_network();
        ok(id);
    }

    void handle(double id, const PollOnceCommand&) {
        // Core owns its poll ticker and exposes no one-shot entry point. Asking for one is the
        // first of the background-and-push questions in docs/STATUS.md; until it is answered
        // there is nothing honest to call here.
        fail(id, "pollOnce is not supported by this libsession build");
    }

    void handle(double id, const SetPushTokenCommand&) {
        fail(id, "setPushToken is not implemented by the bridge yet");
    }

    void handle(double id, const HandlePushPayloadCommand&) {
        fail(id, "handlePushPayload is not implemented by the bridge yet");
    }

    void handle(double id, const GetConversationsCommand&) {
        client->conversations(on(id, [this, id](std::vector<client::AnyConversation> convos) {
            conversation_list(id, convos);
        }));
    }

    void handle(double id, const GetMessageRequestsCommand&) {
        client->message_requests(on(id, [this, id](std::vector<client::AnyConversation> convos) {
            conversation_list(id, convos);
        }));
    }

    void handle(double id, const GetConversationCommand& cmd) {
        const auto convo_id = cmd.conversation_id;
        client->conversation(
                client::ConversationId::parse(convo_id),
                on(id, [this, id, convo_id](std::optional<client::AnyConversation> convo) {
                    if (!convo)
                        fail(id, not_found("conversation", convo_id));
                    else
                        one_conversation(id, *convo);
                }));
    }

    void handle(double id, const OpenDmCommand& cmd) {
        const auto session_id = cmd.session_id;
        client->open_dm(
                client::ConversationId::parse(session_id),
                on(id, [this, id, session_id](std::optional<client::DM> dm) {
                    if (!dm)
                        fail(id, not_found("account", session_id));
                    else
                        one_conversation(id, client::AnyConversation{*dm});
                }));
    }

    void handle(double id, const MarkReadCommand& cmd) {
        std::optional<sys_ms> up_to;
        if (cmd.up_to)
            up_to = from_epoch_ms(whole(*cmd.up_to));
        convo(cmd.conversation_id).mark_read(up_to, on(id, [this, id] { ok(id); }));
    }

    void handle(double id, const SetBlockedCommand& cmd) {
        client->set_blocked(
                client::ConversationId::parse(cmd.conversation_id),
                cmd.blocked,
                on(id, [this, id] { ok(id); }));
    }

    void handle(double id, const SetPriorityCommand& cmd) {
        convo(cmd.conversation_id)
                .set_priority(static_cast<int>(cmd.priority), on(id, [this, id] { ok(id); }));
    }

    void handle(double id, const SetNicknameCommand& cmd) {
        const auto convo_id = cmd.conversation_id;
        const auto nickname = cmd.nickname.value_or("");
        client->dm(
                client::ConversationId::parse(convo_id),
                on(id, [this, id, convo_id, nickname](std::optional<client::DM> dm) {
                    if (!dm)
                        fail(id, not_found("conversation", convo_id));
                    else
                        dm->set_nickname(nickname, on(id, [this, id] { ok(id); }));
                }));
    }

    void handle(double id, const ApproveConversationCommand&) {
        // There is no such call, by design: libsession records approval from messages flowing,
        // and writing to someone is what approves them (see DM::request). A conversation-layer
        // way to accept a request without answering it is one of the open questions in
        // docs/STATUS.md.
        fail(id,
             "approveConversation has no libsession counterpart: approval is recorded by "
             "sending, not set");
    }

    void handle(double id, const DeleteConversationCommand& cmd) {
        convo(cmd.conversation_id)
                .delete_conversation(cmd.keep_messages, on(id, [this, id] { ok(id); }));
    }

    void handle(double id, const GetMessagesCommand& cmd) {
        std::optional<client::MessageCursor> before;
        if (cmd.before)
            before = client::MessageCursor{
                    from_epoch_ms(whole(cmd.before->timestamp)), whole(cmd.before->id)};
        convo(cmd.conversation_id)
                .messages(
                        static_cast<int>(cmd.limit),
                        before,
                        on(id, [this, id](std::vector<client::Message> messages) {
                            std::vector<Message> out;
                            out.reserve(messages.size());
                            // libsession answers newest first, because that is the direction
                            // paging runs. The protocol is oldest first, because that is the
                            // direction a transcript is read, and reversing once here is cheaper
                            // than every caller remembering to.
                            for (const auto& m : std::views::reverse(messages))
                                out.push_back(to_bridge(m));
                            respond(id, MessageListResult{std::move(out)});
                        }));
    }

    void handle(double id, const SendMessageCommand& cmd) {
        client::OutgoingMessage msg;
        msg.body = cmd.body;
        if (cmd.reply_to)
            msg.reply_to = whole(*cmd.reply_to);
        for (const auto& a : cmd.attachments) {
            client::OutgoingAttachment out;
            out.path = a.path;
            out.content_type = a.content_type;
            out.filename = a.filename;
            out.caption = a.caption;
            out.voice_message = a.voice_message.value_or(false);
            if (a.width)
                out.width = static_cast<uint32_t>(*a.width);
            if (a.height)
                out.height = static_cast<uint32_t>(*a.height);
            msg.attachments.push_back(std::move(out));
        }
        convo(cmd.conversation_id)
                .send_message(std::move(msg), on(id, [this, id](int64_t message_id) {
                                  respond(id, MessageIdResult{static_cast<double>(message_id)});
                              }));
    }

    void handle(double id, const RetrySendCommand& cmd) {
        const int64_t message_id = whole(cmd.message_id);
        // A retry re-uploads whatever did not get through, and reports it the way the original
        // send did. There is no overload without a progress handler, and a retry is where a
        // file that has since been deleted is discovered, so this is not a formality.
        client->retry_send(
                message_id,
                [this, id, message_id](
                        size_t index, int64_t sent, int64_t total, std::optional<int> result) {
                    attachment_progress(id, std::nullopt, message_id, index, sent, total, result);
                },
                on(id, [this, id](bool started) { respond(id, BoolResult{started}); }));
    }

    void handle(double id, const DeleteMessageCommand& cmd) {
        auto answer = on(id, [this, id](bool deleted) { respond(id, BoolResult{deleted}); });
        if (cmd.scope == Deletion::everywhere)
            client->delete_message_everywhere(whole(cmd.message_id), std::move(answer));
        else
            client->delete_message(whole(cmd.message_id), std::move(answer));
    }

    void handle(double id, const GetPrefCommand& cmd) {
        respond(id, PrefResult{client->core.globals.get_text(cmd.key)});
    }

    void handle(double id, const SetPrefCommand& cmd) {
        client->core.globals.set(cmd.key, cmd.value);
        ok(id);
    }

    // The test-only commands are part of the protocol on every build, so that the fake and the
    // TypeScript can name them; only a SESSION_BRIDGE_TESTING build serves them.

    void handle(double id, [[maybe_unused]] const GetTestAccountSeedCommand& cmd) {
#ifdef SESSION_BRIDGE_TESTING
        // Named, because the accessor is what holds the secure buffer readable and the rvalue
        // overloads are deleted precisely to stop this being a one-liner.
        auto access = client->core.globals.account_seed();
        auto raw = access.seed();
        respond(id, HexResult{to_hex(std::as_bytes(std::span{raw}))});
#else
        fail(id, "getTestAccountSeed is only served by a SESSION_BRIDGE_TESTING build");
#endif
    }

    void handle(double id, [[maybe_unused]] const DeliverTestMessageCommand& cmd) {
#ifdef SESSION_BRIDGE_TESTING
        auto seed = oxenc::from_hex(cmd.sender_seed_hex);
        if (seed.size() != 32)
            throw std::invalid_argument{"senderSeedHex must be 32 bytes of hex"};

        const int64_t timestamp = whole(cmd.timestamp);
        const auto sent = from_epoch_ms(timestamp);

        SessionProtos::Content content;
        content.set_sigtimestamp(static_cast<uint64_t>(timestamp));
        content.mutable_datamessage()->set_body(cmd.body);
        auto plaintext = content.SerializeAsString();

        b33 recipient;
        std::ranges::copy(client->core.globals.session_id(), recipient.begin());

        auto encoded = encode_dm_v1(
                std::as_bytes(std::span{plaintext}),
                ed25519::PrivKeySpan::from(std::as_bytes(std::span{seed})),
                sent,
                recipient);

        // The hash is the swarm's, and a redelivered one is how libsession recognises a
        // duplicate - so it has to be stable for a message and different between messages.
        core::SwarmMessage message{
                encoded,
                "test-" + std::to_string(timestamp) + "-" +
                        std::to_string(std::hash<std::string>{}(cmd.body)),
                sent,
                from_epoch_ms(timestamp + 14 * 24 * 60 * 60 * 1000)};

        // Onto Core's loop, because the connection pool is single-threaded by design and this
        // is the one place the bridge writes the database from outside it.
        client->core.loop().call_get([&] {
            client->core.receive_messages({&message, 1}, config::Namespace::Default, true);
            return 0;
        });
        ok(id);
#else
        fail(id, "deliverTestMessage is only served by a SESSION_BRIDGE_TESTING build");
#endif
    }

    void handle(double id, [[maybe_unused]] const ApproveTestContactCommand& cmd) {
#ifdef SESSION_BRIDGE_TESTING
        auto decoded = oxenc::from_hex(cmd.session_id);
        if (decoded.size() != 33)
            throw std::invalid_argument{"sessionId must be 33 bytes of hex"};
        b33 sid;
        std::memcpy(sid.data(), decoded.data(), sid.size());
        client->core.loop().call_get([&] {
            auto conn = client->core.database().conn();
            conn.prepared_exec("INSERT OR IGNORE INTO accounts (session_id) VALUES (?)", sid);
            conn.prepared_exec(
                    "INSERT INTO contacts (account, approved) VALUES ("
                    "(SELECT id FROM accounts WHERE session_id = ?), 1) "
                    "ON CONFLICT (account) DO UPDATE SET approved = 1",
                    sid);
            return 0;
        });
        ok(id);
#else
        fail(id, "approveTestContact is only served by a SESSION_BRIDGE_TESTING build");
#endif
    }

    void handle(double id, [[maybe_unused]] const EchoTestFrameCommand& cmd) {
#ifdef SESSION_BRIDGE_TESTING
        // Straight back out, then the acknowledgement: what arrived through the platform's
        // from-JS converter leaves through its to-JS converter, field for field.
        emit(cmd.frame);
        ok(id);
#else
        fail(id, "echoTestFrame is only served by a SESSION_BRIDGE_TESTING build");
#endif
    }

    void dispatch(const Request& request) {
        std::visit([&](const auto& cmd) { handle(request.id, cmd); }, request.command);
    }
};

ClientBridge::ClientBridge(InitOptions options, Sink sink) :
        _impl{std::make_unique<Impl>(std::move(sink), options)} {

    auto* impl = _impl.get();

    // Every handler does the same two things and nothing else: fill a frame, and hand it to the
    // sink. That is what makes running them inline on Core's loop correct rather than merely
    // convenient.
    client::callbacks cbs{
            .conversation_added =
                    [impl](const client::AnyConversation& c) {
                        impl->event(ConversationAddedBridgeEvent{to_bridge(c)});
                    },
            .conversation_updated =
                    [impl](const client::AnyConversation& c) {
                        impl->event(ConversationUpdatedBridgeEvent{to_bridge(c)});
                    },
            .conversation_removed =
                    [impl](const client::ConversationId& id) {
                        impl->event(ConversationRemovedBridgeEvent{id.to_string()});
                    },
            .conversation_list_replaced =
                    [impl](std::vector<client::AnyConversation> convos) {
                        impl->event(ConversationListReplacedBridgeEvent{Impl::conversations(convos)});
                    },
            .request_list_replaced =
                    [impl](std::vector<client::AnyConversation> convos) {
                        impl->event(RequestListReplacedBridgeEvent{Impl::conversations(convos)});
                    },
            .message_added =
                    [impl](const client::ConversationId& id, const client::Message& m) {
                        impl->event(MessageAddedBridgeEvent{id.to_string(), to_bridge(m)});
                    },
            .message_updated =
                    [impl](const client::ConversationId& id, const client::Message& m) {
                        impl->event(MessageUpdatedBridgeEvent{id.to_string(), to_bridge(m)});
                    },
            .history_replaced =
                    [impl](const client::ConversationId& id) {
                        impl->event(HistoryReplacedBridgeEvent{id.to_string()});
                    },
            .attachment_progress =
                    [impl](const client::ConversationId& id, const client::AttachmentProgress& p) {
                        // Only background fetches come through here; a transfer the app asked for
                        // reports to that request instead, which is what request_id distinguishes.
                        impl->attachment_progress(
                                std::nullopt,
                                id.to_string(),
                                p.message_id,
                                p.index,
                                p.done,
                                p.total,
                                p.result);
                    },
            .display_picture_progress =
                    [impl](const client::ConversationId& id,
                           int64_t done,
                           int64_t total,
                           std::optional<int> result) {
                        std::optional<double> outcome;
                        if (result)
                            outcome = static_cast<double>(*result);
                        impl->event(DisplayPictureProgressBridgeEvent{
                                id.to_string(),
                                static_cast<double>(done),
                                static_cast<double>(total),
                                outcome});
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

    // Set up after the Client exists, so nothing arrives before there is a sink to take it.
    if (!options.log_level.empty()) {
        auto level = options.log_level == "trace"      ? LogLevel::trace
                     : options.log_level == "debug"    ? LogLevel::debug
                     : options.log_level == "info"     ? LogLevel::info
                     : options.log_level == "error"    ? LogLevel::error
                     : options.log_level == "critical" ? LogLevel::critical
                                                       : LogLevel::warn;
        logger_reset_level(level);

        auto* impl = _impl.get();
        add_logger([impl](std::string_view message, std::string_view category, LogLevel lvl) {
            // Called from whichever thread logged, including Core's loop and the network's own
            // threads, and after close() has dropped the sink - emit() checks for that, which
            // is the only reason this is safe to leave registered.
            impl->event(LogBridgeEvent{
                    std::string{message}, std::string{category}, std::string{lvl.to_string()}});
        });
    }

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

void ClientBridge::call(Request request) {
    if (!_impl || !_impl->client)
        return;

    try {
        _impl->dispatch(request);
    } catch (const std::exception& e) {
        // Validation throws on the calling thread: ConversationId::parse on a malformed id, a
        // reply_to naming a message in another conversation. Those are answers to this request,
        // not bridge failures.
        _impl->fail(request.id, e.what());
    }
}

}  // namespace session::bridge
