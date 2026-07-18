#import <React/RCTViewManager.h>
#import "GlassBlurView.h"

@interface GlassBlurViewManager : RCTViewManager
@end

@implementation GlassBlurViewManager

RCT_EXPORT_MODULE(GlassBlurView)

- (UIView *)view
{
  return [GlassBlurView new];
}

@end

