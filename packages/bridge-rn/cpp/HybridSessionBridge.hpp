#pragma once

#include <memory>

#include "HybridSessionBridgeSpec.hpp"

// Deliberately fully qualified. Nitro puts us in margelo::nitro::session::bridge::rn, so a name
// starting `session` is looked up inside that namespace first and never reaches the shim - with
// an error that reads as if the header were missing.
namespace session_bridge {
class ClientBridge;
}

namespace margelo::nitro::session::bridge::rn {

/// The bridge behind JSI. A transport and nothing else: the shim does the work, and this is the
/// mobile half of "the platform adapter owns the hop onto the JavaScript thread".
class HybridSessionBridge : public HybridSessionBridgeSpec {
  public:
    // Both out of line, because the unique_ptr below holds a forward-declared type: a defaulted
    // constructor here would instantiate its deleter, which needs the complete one.
    HybridSessionBridge();
    ~HybridSessionBridge() override;

    void setSink(const std::function<void(::session_bridge::Frame /* frame */)>& onFrame) override;
    void init(const SessionBridgeOptions& options) override;
    void call(::session_bridge::Request request) override;
    void close() override;

  private:
    std::function<void(::session_bridge::Frame)> _sink;
    std::unique_ptr<::session_bridge::ClientBridge> _bridge;
};

}  // namespace margelo::nitro::session::bridge::rn
