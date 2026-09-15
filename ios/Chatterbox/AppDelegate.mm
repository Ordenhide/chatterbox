#import "AppDelegate.h"

#import <AVFoundation/AVFoundation.h>
#import <Firebase.h>
#import <React/RCTBundleURLProvider.h>
#import <React/RCTLinkingManager.h>
#import <ReactAppDependencyProvider/RCTAppDependencyProvider.h>

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  self.moduleName = @"Chatterbox";
  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};

  // Required by the New Architecture, and must be set before super's
  // implementation builds the React Native factory below.
  //
  // RCTAppDependencyProvider is codegen output (ios/build/generated) holding the
  // registries of third-party TurboModules and Fabric component views. When it
  // is nil, RCTReactNativeFactory hands Fabric an *empty* component dictionary
  // rather than failing:
  //
  //   return self.delegate.dependencyProvider
  //       ? self.delegate.dependencyProvider.thirdPartyFabricComponents : @{};
  //
  // Every third-party Fabric component then misses "Fallback 2" in
  // RCTComponentViewFactory's lookup and lands on "Fallback 3: Paper Interop",
  // silently mounting the library's *legacy* view manager instead. For
  // safe-area-context that meant its Paper manager dispatched `topInsetsChange`
  // through RCTEventEmitter.receiveEvent, which bridgeless has no renderer to
  // receive — so the insets event was dropped, SafeAreaProvider never got its
  // first insets, and the whole app rendered blank.
  //
  // This app's AppDelegate predates RN 0.77, which is when this became a
  // required step; on the legacy renderer nothing read the property.
  self.dependencyProvider = [RCTAppDependencyProvider new];

  // Ensure voice messages play through speaker and work in silent mode.
  AVAudioSession *session = [AVAudioSession sharedInstance];
  [session setCategory:AVAudioSessionCategoryPlayAndRecord
           withOptions:AVAudioSessionCategoryOptionDefaultToSpeaker |
                        AVAudioSessionCategoryOptionAllowBluetooth
                 error:nil];
  [session setActive:YES error:nil];

  // Ensure Firebase default app is configured for RNFirebase modules.
  if ([FIRApp defaultApp] == nil) {
    [FIRApp configure];
  }

  // The window belongs to the scene now, not the app; see SceneDelegate below.
  // super still builds the React Native factory, it just stops short of
  // creating a UIWindow that no scene would ever show.
  self.automaticallyLoadReactNativeWindow = NO;

  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self getBundleURL];
}

- (NSURL *)bundleURL
{
  return [self getBundleURL];
}

- (NSURL *)getBundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

@end

/**
 * Owns the window. Named by UIApplicationSceneManifest in Info.plist.
 *
 * Apps built with the iOS 27 SDK that do not adopt the scene life cycle are
 * killed at launch: UIKit logs "UIScene life cycle is required for apps built
 * with this SDK" and traps (EXC_BREAKPOINT in
 * _UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption) before any
 * window or JavaScript exists. Xcode's issue navigator shows nothing about it,
 * so the build reads as succeeded and the app as simply not running. iOS 26
 * and earlier do not enforce it, which is why a simulator on 26.5 hid this
 * completely.
 *
 * Adopting scenes moves two things off the app delegate, and both have to be
 * carried here or they silently stop working:
 *
 * - The window. RCTAppDelegate made one in didFinishLaunching; that is now
 *   switched off there and done in scene:willConnectToSession: instead, on the
 *   same React Native factory.
 * - Incoming URLs (chatterbox:// invite links). UIKit stops passing them in
 *   launchOptions and stops calling application:openURL:options:. A cold-start
 *   URL arrives in connectionOptions, and is put back into launchOptions under
 *   the key RCTLinkingManager's getInitialURL reads; a URL arriving while the
 *   app is running arrives in scene:openURLContexts: and is posted the way
 *   RCTLinkingManager expects. Before this, the second case was never wired
 *   at all — no openURL handler existed — so a link tapped with the app open
 *   did nothing on iOS.
 */
@interface SceneDelegate : UIResponder <UIWindowSceneDelegate>
@end

@implementation SceneDelegate

@synthesize window = _window;

- (void)scene:(UIScene *)scene
    willConnectToSession:(UISceneSession *)session
                 options:(UISceneConnectionOptions *)connectionOptions
{
  if (![scene isKindOfClass:[UIWindowScene class]]) {
    return;
  }

  AppDelegate *app = (AppDelegate *)UIApplication.sharedApplication.delegate;
  UIWindow *window = [[UIWindow alloc] initWithWindowScene:(UIWindowScene *)scene];
  self.window = window;
  app.window = window;

  NSMutableDictionary *launchOptions = [NSMutableDictionary dictionary];
  NSURL *url = connectionOptions.URLContexts.anyObject.URL;
  if (url != nil) {
    launchOptions[UIApplicationLaunchOptionsURLKey] = url;
  }

  [app.reactNativeFactory startReactNativeWithModuleName:app.moduleName
                                                inWindow:window
                                       initialProperties:app.initialProps
                                           launchOptions:launchOptions];
}

- (void)scene:(UIScene *)scene openURLContexts:(NSSet<UIOpenURLContext *> *)URLContexts
{
  for (UIOpenURLContext *context in URLContexts) {
    [RCTLinkingManager application:UIApplication.sharedApplication openURL:context.URL options:@{}];
  }
}

@end
