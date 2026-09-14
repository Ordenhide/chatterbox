#import <React/RCTBridgeModule.h>
#import <UIKit/UIKit.h>

@interface ScreenshotGuard : NSObject <RCTBridgeModule>
@end

@implementation ScreenshotGuard

RCT_EXPORT_MODULE();

RCT_EXPORT_METHOD(setSecureFlag:(BOOL)enabled) {
  // Deliberately empty, and deliberately still here.
  //
  // iOS has no FLAG_SECURE. There is no API that stops a screenshot, and
  // UIApplicationUserDidTakeScreenshotNotification only tells you one already
  // happened — which is a different feature, not this one.
  //
  // The previous comment said "we handle it at the app level". Nothing did.
  // What actually happens is that services/privacyGuard.ts returns false for
  // any platform but Android before it reaches this module, so the UI reports
  // the window as unprotected, which is the truth. That is the contract: the
  // claim comes from the mechanism, never from a flag beside it.
  //
  // The module stays so the Xcode project reference resolves and so the next
  // person looking for iOS screenshot protection finds this explanation
  // instead of its absence.
}

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

@end
