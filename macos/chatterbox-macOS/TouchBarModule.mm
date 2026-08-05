#import "TouchBarModule.h"
#import <AppKit/AppKit.h>

static NSString *const kTouchBarPressed = @"touchBarItemPressed";
static NSTouchBarCustomizationIdentifier const kBarIdentifier = @"com.chatterbox.touchbar";

/**
 * Owns the NSTouchBar and turns taps into React Native events.
 *
 * Kept as a separate object from the module so the bar can outlive a single
 * `makeTouchBar` call — AppKit asks for the bar lazily and may ask again after
 * the responder chain changes.
 */
@interface ChatterboxTouchBarProvider : NSObject <NSTouchBarDelegate>
@property(nonatomic, copy) NSArray<NSDictionary *> *items;
@property(nonatomic, copy) void (^onPress)(NSString *identifier);
@end

@implementation ChatterboxTouchBarProvider

- (NSTouchBar *)makeTouchBar
{
  NSTouchBar *bar = [NSTouchBar new];
  bar.delegate = self;
  bar.customizationIdentifier = kBarIdentifier;

  NSMutableArray<NSTouchBarItemIdentifier> *ids = [NSMutableArray array];
  for (NSDictionary *item in self.items) {
    NSString *key = item[@"id"];
    if ([key isKindOfClass:[NSString class]] && key.length > 0) {
      [ids addObject:key];
    }
  }
  // Trailing flexible space keeps the buttons left-aligned rather than
  // stretched across the whole strip, which is what every first-party app does.
  [ids addObject:NSTouchBarItemIdentifierFlexibleSpace];

  bar.defaultItemIdentifiers = ids;
  bar.customizationAllowedItemIdentifiers = ids;
  return bar;
}

- (nullable NSTouchBarItem *)touchBar:(NSTouchBar *)touchBar
                makeItemForIdentifier:(NSTouchBarItemIdentifier)identifier
{
  NSDictionary *match = nil;
  for (NSDictionary *item in self.items) {
    if ([item[@"id"] isEqualToString:identifier]) {
      match = item;
      break;
    }
  }
  if (match == nil) {
    return nil;
  }

  NSCustomTouchBarItem *item = [[NSCustomTouchBarItem alloc] initWithIdentifier:identifier];
  NSString *title = match[@"title"] ?: @"";

  NSButton *button;
  NSString *symbol = match[@"systemSymbol"];
  if ([symbol isKindOfClass:[NSString class]] && symbol.length > 0) {
    // SF Symbols render at the Touch Bar's own scale and stay legible where a
    // bitmap would not. Falls back to the title when the symbol name is
    // unknown on this OS version.
    NSImage *image = [NSImage imageWithSystemSymbolName:symbol accessibilityDescription:title];
    button = image != nil ? [NSButton buttonWithImage:image target:self action:@selector(handlePress:)]
                          : [NSButton buttonWithTitle:title target:self action:@selector(handlePress:)];
  } else {
    button = [NSButton buttonWithTitle:title target:self action:@selector(handlePress:)];
  }

  button.identifier = identifier;
  item.view = button;
  // Shown in the Touch Bar customisation sheet.
  item.customizationLabel = title;
  return item;
}

- (void)handlePress:(NSButton *)sender
{
  if (self.onPress != nil && sender.identifier != nil) {
    self.onPress(sender.identifier);
  }
}

@end

@implementation TouchBarModule {
  ChatterboxTouchBarProvider *_provider;
  BOOL _hasListeners;
}

RCT_EXPORT_MODULE(TouchBar);

+ (BOOL)requiresMainQueueSetup
{
  // Touches AppKit (NSTouchBar/NSWindow), which is main-thread only.
  return YES;
}

- (NSArray<NSString *> *)supportedEvents
{
  return @[kTouchBarPressed];
}

- (void)startObserving
{
  _hasListeners = YES;
}

- (void)stopObserving
{
  _hasListeners = NO;
}

/**
 * Whether this Mac actually has a Touch Bar.
 *
 * Asks AppKit rather than matching model identifiers: `NSTouchBar` only exists
 * from macOS 10.12.2, and `NSApplication.isAutomaticCustomizeTouchBarMenuItemEnabled`
 * is only meaningful on hardware that has the strip. A model-name check would
 * need updating for every new Mac; this does not.
 */
RCT_EXPORT_METHOD(isSupported : (RCTPromiseResolveBlock)resolve reject : (RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    BOOL available = NSClassFromString(@"NSTouchBar") != nil;
    resolve(@(available));
  });
}

/**
 * Replaces the Touch Bar contents.
 *
 * `items` is an array of {id, title, systemSymbol?}. Passing an empty array
 * clears the bar, which is how a screen with no Touch Bar actions opts out.
 */
RCT_EXPORT_METHOD(setItems : (NSArray<NSDictionary *> *)items)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    if (NSClassFromString(@"NSTouchBar") == nil) {
      return;
    }
    if (self->_provider == nil) {
      self->_provider = [ChatterboxTouchBarProvider new];
      __weak __typeof(self) weakSelf = self;
      self->_provider.onPress = ^(NSString *identifier) {
        __strong __typeof(weakSelf) strongSelf = weakSelf;
        // Dropping the event when nothing is listening avoids RN's
        // "sending event with no listeners" warning on every tap.
        if (strongSelf != nil && strongSelf->_hasListeners) {
          [strongSelf sendEventWithName:kTouchBarPressed body:@{@"id" : identifier}];
        }
      };
    }
    self->_provider.items = items ?: @[];

    NSWindow *window = NSApplication.sharedApplication.mainWindow ?: NSApplication.sharedApplication.windows.firstObject;
    if (window == nil) {
      return;
    }
    // Assigning to the window (not the app) scopes the bar to this window and
    // makes AppKit rebuild it immediately; setting it to nil first forces a
    // refresh when only the item list changed.
    window.touchBar = nil;
    window.touchBar = [self->_provider makeTouchBar];
  });
}

@end
