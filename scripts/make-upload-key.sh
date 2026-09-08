#!/bin/bash
# Generates the Chatterbox Play upload key and wires it into Gradle.
#
# Run this yourself: the password is read from a silent prompt and only ever
# lives in an environment variable inside this script's own process. It is
# never an argument (so it never shows in `ps`), never echoed, and never
# written anywhere except ~/.gradle/gradle.properties, which this chmods to
# 600.
#
# Under Play App Signing — mandatory for new apps — this is the *upload* key,
# not the app signing key. Google holds that one. If you lose this, it can be
# reset from the Play Console; it is not the unrecoverable disaster the old
# README claimed. Back it up anyway.
#
# This is NOT the key that signs the APKs on GitHub Releases. That one is
# android/app/chatterbox-release.keystore (SHA-1 3E:3B:F4:90…, subject
# CN=Xiaohan Liu, L=Halifax, ST=NS, C=CA), it is unrecoverable, and anything
# distributed as an update to v1.1.0 must still be signed with it. See
# RELEASE_KEYSTORE_SECRETS.txt (gitignored) for which keystore is which.

set -euo pipefail

KEYSTORE="${KEYSTORE:-$HOME/chatterbox-upload.keystore}"
ALIAS="${ALIAS:-chatterbox-upload}"
# Cosmetic — nobody installing the app ever sees this — but it cannot be
# changed after the fact. Override by exporting DNAME before running.
# The existing release key is CN=Xiaohan Liu, L=Halifax, ST=NS, C=CA; match it
# or don't, but decide deliberately — it is baked in for the life of the key.
DNAME="${DNAME:-CN=Chatterbox, O=Chatterbox, C=CN}"

if [ -e "$KEYSTORE" ]; then
  echo "refusing to overwrite an existing keystore: $KEYSTORE" >&2
  echo "move it aside first, or run with KEYSTORE=/some/other/path" >&2
  exit 1
fi

printf 'Keystore:  %s\n' "$KEYSTORE"
printf 'Alias:     %s\n' "$ALIAS"
printf 'Subject:   %s\n' "$DNAME"
printf 'Validity:  10950 days (~30 years)\n\n'

# -s reads silently, so the password is never on screen or in scrollback.
read -r -s -p "New keystore password (12+ chars): " KS_PW
echo
read -r -s -p "Repeat it: " KS_PW2
echo

if [ "$KS_PW" != "$KS_PW2" ]; then
  echo "those did not match — nothing was created." >&2
  exit 1
fi
if [ "${#KS_PW}" -lt 12 ]; then
  echo "too short — this key signs every build you will ever ship." >&2
  exit 1
fi
unset KS_PW2

export KS_PW

# PKCS12 rather than the legacy JKS keytool now warns about. PKCS12 does not
# keep a separate key password, so store and key password are the same value —
# which is why build.gradle's two properties below get the same thing.
keytool -genkeypair -v \
  -keystore "$KEYSTORE" \
  -storetype PKCS12 \
  -alias "$ALIAS" \
  -keyalg RSA -keysize 4096 \
  -validity 10950 \
  -dname "$DNAME" \
  -storepass:env KS_PW \
  -keypass:env KS_PW

chmod 600 "$KEYSTORE"

GP="$HOME/.gradle/gradle.properties"
mkdir -p "$HOME/.gradle"

if [ -e "$GP" ] && grep -q '^CHATTERBOX_STORE_FILE' "$GP"; then
  echo
  echo "$GP already has CHATTERBOX_* properties — leaving it alone." >&2
  echo "Update these four by hand:" >&2
  printf '  CHATTERBOX_STORE_FILE=%s\n  CHATTERBOX_STORE_PASSWORD=<the password you just typed>\n  CHATTERBOX_KEY_ALIAS=%s\n  CHATTERBOX_KEY_PASSWORD=<the same password>\n' "$KEYSTORE" "$ALIAS" >&2
else
  # Appended, not overwritten: this file is global to every Gradle project on
  # the machine and may hold unrelated settings.
  {
    echo ""
    echo "# Chatterbox Play upload key. Global to this machine, never in the repo."
    echo "CHATTERBOX_STORE_FILE=$KEYSTORE"
    echo "CHATTERBOX_STORE_PASSWORD=$KS_PW"
    echo "CHATTERBOX_KEY_ALIAS=$ALIAS"
    echo "CHATTERBOX_KEY_PASSWORD=$KS_PW"
  } >> "$GP"
  chmod 600 "$GP"
  echo
  echo "wrote credentials to $GP (mode 600)"
fi

echo
echo "=============================================================="
echo " Fingerprints — the SHA-1 is what step 2 registers in Firebase"
echo "=============================================================="
keytool -list -v -keystore "$KEYSTORE" -alias "$ALIAS" -storepass:env KS_PW \
  | grep -E "SHA1:|SHA256:|Valid from"

unset KS_PW

cat <<'NEXT'

--------------------------------------------------------------
Back up all three, in a password manager:
  1. the keystore file itself
  2. the password you just typed
  3. base64 -i <keystore> | pbcopy      <- GitHub secret
                                           CHATTERBOX_KEYSTORE_BASE64

The other three GitHub secrets are CHATTERBOX_STORE_PASSWORD,
CHATTERBOX_KEY_ALIAS, CHATTERBOX_KEY_PASSWORD — same values as
the ones just written to ~/.gradle/gradle.properties.
--------------------------------------------------------------
NEXT
