#import "GlassBlurView.h"

@implementation GlassBlurView {
  UIVisualEffectView *_blurView;
}

- (instancetype)initWithFrame:(CGRect)frame
{
  self = [super initWithFrame:frame];
  if (self) {
    [self setupBlurView];
  }
  return self;
}

- (void)setupBlurView
{
  if (_blurView) {
    return;
  }

  self.backgroundColor = [UIColor clearColor];
  self.clipsToBounds = YES;

  UIBlurEffect *blurEffect;
  if (@available(iOS 13.0, *)) {
    blurEffect = [UIBlurEffect effectWithStyle:UIBlurEffectStyleSystemThinMaterial];
  } else {
    blurEffect = [UIBlurEffect effectWithStyle:UIBlurEffectStyleExtraLight];
  }

  _blurView = [[UIVisualEffectView alloc] initWithEffect:blurEffect];
  _blurView.userInteractionEnabled = NO;
  _blurView.alpha = 0.3;
  _blurView.frame = self.bounds;
  _blurView.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
  [self addSubview:_blurView];
}

- (void)layoutSubviews
{
  [super layoutSubviews];
  if (_blurView) {
    _blurView.frame = self.bounds;
  }
}

@end

