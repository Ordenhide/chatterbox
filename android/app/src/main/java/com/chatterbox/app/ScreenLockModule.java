package com.chatterbox.app;

import android.app.KeyguardManager;
import android.content.Context;
import androidx.annotation.NonNull;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

/**
 * Whether the screen is locked right now.
 *
 * Exists because Android's own answer to this — posting a notification with
 * VISIBILITY_PRIVATE and letting the platform redact it on a secure lock
 * screen — is not one the app can rely on. Redaction happens only if the user
 * has turned on "hide sensitive notifications", and on most devices that is
 * off, so a message's plaintext went on the lock screen in full. Deciding the
 * notification's body here instead makes the behaviour the app's own rather
 * than a system setting's.
 *
 * Reads the *application* context deliberately. This is called from the
 * background message handler, which runs as a headless task with no activity,
 * so getCurrentActivity() would be null exactly when the answer matters.
 */
public class ScreenLockModule extends ReactContextBaseJavaModule {
    ScreenLockModule(ReactApplicationContext context) {
        super(context);
    }

    @NonNull
    @Override
    public String getName() {
        return "ScreenLock";
    }

    /**
     * isKeyguardLocked, not isDeviceSecure: the question is whether the lock
     * screen is up now, not whether one is configured at all. A device with no
     * lock set answers false, which is correct — there is no locked state to
     * hide anything behind.
     */
    @ReactMethod
    public void isLocked(Promise promise) {
        try {
            KeyguardManager keyguard =
                    (KeyguardManager)
                            getReactApplicationContext().getSystemService(Context.KEYGUARD_SERVICE);
            promise.resolve(keyguard != null && keyguard.isKeyguardLocked());
        } catch (Exception e) {
            // Fail closed: an unanswerable question must not be read as
            // "unlocked", which is the answer that puts plaintext on screen.
            promise.resolve(true);
        }
    }
}
