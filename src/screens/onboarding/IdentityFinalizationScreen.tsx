import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

type IdentityFinalizationScreenProps = {
  onBack?: () => void;
  onNext?: () => void;
};

const palette = {
  background: "#0e0e0e",
  surfaceContainerLow: "#131313",
  surfaceContainerHigh: "#201f1f",
  surfaceContainerHighest: "#262626",
  onSurface: "#ffffff",
  onSurfaceVariant: "#adaaaa",
  primary: "#ba9eff",
  primaryDim: "#8455ef",
  onPrimary: "#39008c",
  outlineVariant: "#494847",
};

const AVATAR_BG_URI =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuD_j59gIbqGNP0GB2nWXq56J9n5g-Cq00ZFgpWuSuzplXKUeqxTtYwkZYaD2gu1F2A8D3GIz-Hg4_L_ocTtpbBbnYMHkQA94Tzffs5AbgbsQR76bjtPVun3Zs5-O2qiXUvrYed0dUU6obVbfKYPUHphuRSbCTD8BOUrW2lbji0zfcvoFuzr6kc3NXkIICfk3hHd-lKN_QB5jBfbS021Uy_DzY0im5VQ1Bwr92VTFTSlXGIpLbR5Nox3gWVurb48JHFRHZuPfSeENZ0_";

export function IdentityFinalizationScreen({ onBack, onNext }: IdentityFinalizationScreenProps) {
  const insets = useSafeAreaInsets();

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const [stageName, setStageName] = useState("");
  const [bio, setBio] = useState("");
  const [instagram, setInstagram] = useState("");
  const [soundCloud, setSoundCloud] = useState("");

  if (!fontsLoaded) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator color={palette.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}> 
        <Pressable onPress={onBack} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
          <MaterialIcons name="arrow-back" size={22} color={palette.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Finalize Your Identity</Text>
        <View style={styles.iconSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.contentContainer, { paddingTop: insets.top + 86 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentInner}>
          <View style={styles.progressRow}>
            <View style={styles.progressBar} />
            <View style={styles.progressBar} />
            <View style={styles.progressBar} />
            <View style={styles.progressBar} />
            <View style={styles.progressBarActive} />
          </View>

          <View style={styles.profileUploadWrap}>
            <Pressable style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}>
              <Image source={{ uri: AVATAR_BG_URI }} style={styles.avatarBg} />
              <View style={styles.avatarOverlay} />
              <MaterialIcons name="add-circle" size={48} color={palette.primary} />
            </Pressable>
            <Text style={styles.avatarTitle}>Upload Profile Photo</Text>
            <Text style={styles.avatarSubtitle}>Tap to select your aesthetic</Text>
          </View>

          <View style={styles.formWrap}>
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Stage Name</Text>
              <TextInput
                value={stageName}
                onChangeText={setStageName}
                placeholder="e.g. Alex Rivers"
                placeholderTextColor="rgba(173,170,170,0.4)"
                style={styles.fieldInput}
              />
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Your Bio</Text>
              <TextInput
                value={bio}
                onChangeText={setBio}
                multiline
                textAlignVertical="top"
                placeholder="Tell the network about your sound..."
                placeholderTextColor="rgba(173,170,170,0.4)"
                style={styles.bioInput}
              />
            </View>

            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Social Connections</Text>

              <View style={styles.iconInputWrap}>
                <MaterialIcons name="campaign" size={20} color={palette.onSurfaceVariant} style={styles.leftIcon} />
                <TextInput
                  value={instagram}
                  onChangeText={setInstagram}
                  placeholder="Instagram handle"
                  placeholderTextColor="rgba(173,170,170,0.4)"
                  style={styles.iconInput}
                />
              </View>

              <View style={styles.iconInputWrap}>
                <MaterialIcons name="podcasts" size={20} color={palette.onSurfaceVariant} style={styles.leftIcon} />
                <TextInput
                  value={soundCloud}
                  onChangeText={setSoundCloud}
                  placeholder="SoundCloud URL"
                  placeholderTextColor="rgba(173,170,170,0.4)"
                  style={styles.iconInput}
                />
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerInner}>
          <Pressable onPress={onNext} style={({ pressed }) => [styles.ctaOuter, pressed && styles.pressed]}>
            <LinearGradient
              colors={[palette.primary, palette.primaryDim]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.ctaButton}
            >
              <Text style={styles.ctaText}>Enter the Pulse</Text>
              <MaterialIcons name="bolt" size={20} color={palette.onPrimary} />
            </LinearGradient>
          </Pressable>

          <Text style={styles.footerMeta}>Step 5 of 5 - Finalizing Decentralized ID</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  loaderWrap: {
    flex: 1,
    backgroundColor: palette.background,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    paddingHorizontal: 24,
    paddingBottom: 10,
    backgroundColor: "rgba(14,14,14,0.7)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  iconSpacer: {
    width: 40,
    height: 40,
  },
  headerTitle: {
    color: palette.onSurface,
    fontSize: 18,
    letterSpacing: -0.3,
    fontFamily: "Inter_600SemiBold",
  },
  scroll: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingBottom: 150,
  },
  contentInner: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
  },
  progressRow: {
    marginBottom: 48,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  progressBar: {
    width: 32,
    height: 6,
    borderRadius: 999,
    backgroundColor: palette.surfaceContainerHighest,
  },
  progressBarActive: {
    width: 48,
    height: 6,
    borderRadius: 999,
    backgroundColor: palette.primary,
    shadowColor: palette.primary,
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
  },
  profileUploadWrap: {
    alignItems: "center",
    marginBottom: 44,
  },
  avatarButton: {
    width: 144,
    height: 144,
    borderRadius: 72,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: palette.outlineVariant,
    backgroundColor: palette.surfaceContainerLow,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarBg: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.4,
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(14,14,14,0.2)",
  },
  avatarTitle: {
    marginTop: 16,
    color: palette.onSurface,
    fontSize: 16,
    fontFamily: "Inter_500Medium",
  },
  avatarSubtitle: {
    marginTop: 4,
    color: palette.onSurfaceVariant,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  formWrap: {
    gap: 28,
  },
  fieldWrap: {
    gap: 8,
  },
  fieldLabel: {
    marginLeft: 4,
    color: palette.onSurfaceVariant,
    textTransform: "uppercase",
    letterSpacing: 1.8,
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  fieldInput: {
    height: 56,
    borderRadius: 12,
    backgroundColor: palette.surfaceContainerLow,
    color: palette.onSurface,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  bioInput: {
    minHeight: 112,
    borderRadius: 12,
    backgroundColor: palette.surfaceContainerLow,
    color: palette.onSurface,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: "Inter_400Regular",
  },
  iconInputWrap: {
    position: "relative",
    justifyContent: "center",
  },
  leftIcon: {
    position: "absolute",
    left: 14,
    zIndex: 2,
  },
  iconInput: {
    height: 56,
    borderRadius: 12,
    backgroundColor: palette.surfaceContainerLow,
    color: palette.onSurface,
    paddingLeft: 44,
    paddingRight: 16,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(73,72,71,0.1)",
    backgroundColor: "rgba(14,14,14,0.7)",
  },
  footerInner: {
    width: "100%",
    maxWidth: 420,
    alignSelf: "center",
  },
  ctaOuter: {
    borderRadius: 999,
    shadowColor: palette.primary,
    shadowOpacity: 0.1,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 20 },
    elevation: 6,
  },
  ctaButton: {
    height: 64,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  ctaText: {
    color: palette.onPrimary,
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  footerMeta: {
    marginTop: 14,
    textAlign: "center",
    color: "rgba(173,170,170,0.6)",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  pressed: {
    opacity: 0.95,
    transform: [{ scale: 0.985 }],
  },
});
