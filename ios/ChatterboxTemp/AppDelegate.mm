#import "AppDelegate.h"

#import <AVFoundation/AVFoundation.h>
#import <Firebase.h>
#import <React/RCTBundleURLProvider.h>
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
