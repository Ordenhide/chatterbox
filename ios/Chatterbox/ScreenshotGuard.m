#import <React/RCTBridgeModule.h>
#import <UIKit/UIKit.h>

@interface ScreenshotGuard : NSObject <RCTBridgeModule>
@end

@implementation ScreenshotGuard

RCT_EXPORT_MODULE();

RCT_EXPORT_METHOD(setSecureFlag:(BOOL)enabled) {
  // iOS cannot block screenshots via FLAG_SECURE.
  // Instead, listen for UIApplicationUserDidTakeScreenshotNotification.
  // The actual blocking is limited on iOS; we handle it at the app level.
}

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

@end
