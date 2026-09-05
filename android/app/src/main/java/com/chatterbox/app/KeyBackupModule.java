package com.chatterbox.app;

import android.app.KeyguardManager;
import android.content.Context;
import androidx.annotation.NonNull;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.google.android.gms.auth.blockstore.Blockstore;
import com.google.android.gms.auth.blockstore.BlockstoreClient;
import com.google.android.gms.auth.blockstore.DeleteBytesRequest;
import com.google.android.gms.auth.blockstore.RetrieveBytesRequest;
import com.google.android.gms.auth.blockstore.RetrieveBytesResponse;
import com.google.android.gms.auth.blockstore.StoreBytesData;
import java.nio.charset.StandardCharsets;

/**
 * Block Store, Android's answer to iCloud Keychain: a few bytes tied to the
 * user's Google account and handed back during setup on their next device.
 *
 * Exists for one value — the E2EE device secret key, as its recovery phrase —
 * so a new phone can restore itself instead of asking for 24 words.
 *
 * ## Cloud backup is conditional, on purpose
 *
 * Block Store's cloud copy is end-to-end encrypted only when the device has a
 * screen lock; without one the blob is still encrypted, but Google holds the
 * key. Handing an end-to-end encrypted messenger's identity key to a third
 * party that can read it is not a trade this app makes silently, so
 * setShouldBackupToCloud is set from whether a lock is actually present.
 *
 * With no lock the entry still stores locally, which is not useless: Block
 * Store also serves direct device-to-device transfer during setup, where the
 * bytes never leave the two phones.
 */
public class KeyBackupModule extends ReactContextBaseJavaModule {
    KeyBackupModule(ReactApplicationContext context) {
        super(context);
    }

    @NonNull
    @Override
    public String getName() {
        return "KeyBackup";
    }

    private boolean hasScreenLock() {
        KeyguardManager keyguard =
                (KeyguardManager) getReactApplicationContext().getSystemService(Context.KEYGUARD_SERVICE);
        return keyguard != null && keyguard.isDeviceSecure();
    }

    /** Whether a cloud copy would be end-to-end encrypted on this device. */
    @ReactMethod
    public void isCloudBackupSafe(Promise promise) {
        try {
            promise.resolve(hasScreenLock());
        } catch (Exception e) {
            promise.resolve(false);
        }
    }

    @ReactMethod
    public void store(String key, String value, Promise promise) {
        try {
            BlockstoreClient client = Blockstore.getClient(getReactApplicationContext());
            StoreBytesData request =
                    new StoreBytesData.Builder()
                            .setKey(key)
                            .setBytes(value.getBytes(StandardCharsets.UTF_8))
                            .setShouldBackupToCloud(hasScreenLock())
                            .build();
            client.storeBytes(request)
                    .addOnSuccessListener(written -> promise.resolve(true))
                    // Rejecting rather than resolving false: the caller has to be
                    // able to tell "there is no backup" from "the backup did not
                    // happen", or it will tell the user they are covered when
                    // they are not.
                    .addOnFailureListener(e -> promise.reject("store_failed", e));
        } catch (Throwable e) {
            promise.reject("store_failed", e);
        }
    }

    /** The stored value, or null when Block Store holds nothing for this key. */
    @ReactMethod
    public void retrieve(String key, Promise promise) {
        try {
            BlockstoreClient client = Blockstore.getClient(getReactApplicationContext());
            RetrieveBytesRequest request =
                    new RetrieveBytesRequest.Builder().setKeys(java.util.Collections.singletonList(key)).build();
            client.retrieveBytes(request)
                    .addOnSuccessListener(response -> {
                        RetrieveBytesResponse.BlockstoreData data =
                                response.getBlockstoreDataMap().get(key);
                        if (data == null) {
                            promise.resolve(null);
                            return;
                        }
                        promise.resolve(new String(data.getBytes(), StandardCharsets.UTF_8));
                    })
                    .addOnFailureListener(e -> promise.reject("retrieve_failed", e));
        } catch (Throwable e) {
            promise.reject("retrieve_failed", e);
        }
    }

    @ReactMethod
    public void remove(String key, Promise promise) {
        try {
            BlockstoreClient client = Blockstore.getClient(getReactApplicationContext());
            DeleteBytesRequest request =
                    new DeleteBytesRequest.Builder().setKeys(java.util.Collections.singletonList(key)).build();
            client.deleteBytes(request)
                    .addOnSuccessListener(deleted -> promise.resolve(true))
                    .addOnFailureListener(e -> promise.reject("delete_failed", e));
        } catch (Throwable e) {
            promise.reject("delete_failed", e);
        }
    }
}
