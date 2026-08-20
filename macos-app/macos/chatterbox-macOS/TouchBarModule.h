#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

/**
 * Touch Bar support for the Chatterbox macOS client.
 *
 * The Touch Bar only exists on MacBook Pro models from 2016–2021; Apple
 * dropped it afterwards. AppKit handles that for us — on a Mac without one,
 * `NSTouchBar` simply never gets asked for, so the buttons below cost nothing
 * and never appear. `isSupported` lets JS avoid doing pointless work (and lets
 * the UI explain itself) rather than guessing from the model identifier, which
 * would go stale.
 *
 * Buttons are declared from JS so the bar can follow what's on screen (a chat
 * shows different actions than the chat list), and taps come back as events.
 */
@interface TouchBarModule : RCTEventEmitter <RCTBridgeModule>
@end
