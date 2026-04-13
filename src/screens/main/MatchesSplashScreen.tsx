import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
  useFonts,
} from "@expo-google-fonts/inter";
import { MaterialIcons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { APP_COLORS } from "../../constants/theme";

type MatchesSplashScreenProps = {
  onClose?: () => void;
  onSendMessage?: () => void;
  onKeepSwiping?: () => void;
  profileAvatarUrl?: string | null;
  currentUserName?: string | null;
  currentUserRole?: string | null;
  currentUserLocation?: string | null;
  matchedName?: string | null;
  matchedAvatarUrl?: string | null;
  matchedRole?: string | null;
  matchedLocation?: string | null;
};

const palette = {
  background: APP_COLORS.backgroundStrong,
  onSurface: APP_COLORS.textPrimary,
  onSurfaceVariant: APP_COLORS.textSecondary,
  primary: APP_COLORS.primary,
  secondary: APP_COLORS.secondary,
  onPrimary: APP_COLORS.onPrimary,
};

const MATCH_AVATAR_URI =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDzofIk9X20OVXdG7swSArM4K1fA3E7BxpUVlakyiLuO1uz7lEgElPmnvyXQwWZT-08osW_qOGPcx8XQS61R_ZxtvdIg0x5sLP7oyZIDv6iu4mQl6R1Mxmc96k9iSKmsiUuo2QSFMj-znei6FKwXL734OO-R585cuDxNpOQpU71A2v9qL4GOAVDJQ4Ct6F90e6g15qYm1mn1wgoNC1-bCO61ZRdjszVTESz1X0TVBhCeoMC0aYoLvhBsxO-UV_dcbFdBMnpbX7qvvRj";

const FALLBACK_PROFILE_AVATAR =
  "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?q=80&w=512&auto=format&fit=crop";

export function MatchesSplashScreen({
  onClose,
  onSendMessage,
  onKeepSwiping,
  profileAvatarUrl,
  currentUserName,
  currentUserRole,
  currentUserLocation,
  matchedName,
  matchedAvatarUrl,
  matchedRole,
  matchedLocation,
}: MatchesSplashScreenProps) {
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator color={palette.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View pointerEvents="none" style={styles.waveLayer} />
      <View pointerEvents="none" style={styles.blobTopLeft} />
      <View pointerEvents="none" style={styles.blobBottomRight} />

      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Text style={styles.brand}>Matches</Text>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [
            styles.headerAvatarPressable,
            pressed && styles.pressed,
          ]}
        >
          <Image
            source={{ uri: profileAvatarUrl ?? FALLBACK_PROFILE_AVATAR }}
            style={styles.headerAvatar}
          />
        </Pressable>
      </View>

      <View style={[styles.main, { paddingTop: insets.top + 112 }]}>
        <View style={styles.avatarsWrap}>
          <View style={styles.pulseRingOne} />
          <View style={styles.pulseRingTwo} />

          <View style={styles.avatarLeftWrap}>
            <View style={styles.avatarGlow} />
            <Image
              source={{ uri: profileAvatarUrl ?? FALLBACK_PROFILE_AVATAR }}
              style={styles.avatarImage}
            />
          </View>

          <View style={styles.avatarRightWrap}>
            <View style={styles.avatarGlow} />
            <Image
              source={{ uri: matchedAvatarUrl ?? MATCH_AVATAR_URI }}
              style={styles.avatarImage}
            />
          </View>

          <View style={styles.boltBadge}>
            <MaterialIcons name="bolt" size={22} color={palette.onPrimary} />
          </View>
        </View>

        <View style={styles.detailsRow}>
          <View style={styles.userDetailCard}>
            <Text numberOfLines={1} style={styles.userDetailName}>
              {currentUserName ?? "You"}
            </Text>
            <Text numberOfLines={1} style={styles.userDetailMeta}>
              {(currentUserRole ?? "Artist").toUpperCase()}
            </Text>
            <Text numberOfLines={1} style={styles.userDetailMetaSecondary}>
              {currentUserLocation ?? "Remote"}
            </Text>
          </View>
          <View style={styles.userDetailCard}>
            <Text numberOfLines={1} style={styles.userDetailName}>
              {matchedName ?? "Collaborator"}
            </Text>
            <Text numberOfLines={1} style={styles.userDetailMeta}>
              {(matchedRole ?? "Artist").toUpperCase()}
            </Text>
            <Text numberOfLines={1} style={styles.userDetailMetaSecondary}>
              {matchedLocation ?? "Remote"}
            </Text>
          </View>
        </View>

        <View style={styles.copyWrap}>
          <Text style={styles.matchTitle}>
            It's a{"\n"}
            <Text style={styles.matchAccent}>Match!</Text>
          </Text>

          <Text style={styles.matchSubtitle}>
            You and{" "}
            <Text style={styles.matchName}>
              {matchedName ?? "Marcus Miller"}
            </Text>{" "}
            are ready to resonate.
          </Text>
        </View>

        <View style={styles.actionWrap}>
          <Pressable
            onPress={onSendMessage}
            style={({ pressed }) => [
              styles.primaryCta,
              pressed && styles.pressed,
            ]}
          >
            <MaterialIcons
              name="chat-bubble"
              size={18}
              color={palette.onPrimary}
            />
            <Text style={styles.primaryCtaText}>Send a Message</Text>
          </Pressable>

          <Pressable
            onPress={onKeepSwiping}
            style={({ pressed }) => [
              styles.secondaryCta,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.secondaryCtaText}>Keep Swiping</Text>
          </Pressable>
        </View>

        <View style={styles.footerWrap}>
          <Text style={styles.footerText}>
            New Collaborative Frequency Found
          </Text>
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
  waveLayer: {
    position: "absolute",
    left: -120,
    right: -120,
    top: "25%",
    height: 360,
    borderRadius: 999,
    backgroundColor: "rgba(186,158,255,0.05)",
  },
  blobTopLeft: {
    position: "absolute",
    top: -90,
    left: -90,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "rgba(186,158,255,0.1)",
  },
  blobBottomRight: {
    position: "absolute",
    bottom: -110,
    right: -80,
    width: 230,
    height: 230,
    borderRadius: 999,
    backgroundColor: "rgba(192,140,247,0.1)",
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    minHeight: 92,
    paddingBottom: 12,
    paddingHorizontal: 24,
    backgroundColor: "rgba(8,8,8,0.72)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.03)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: {
    color: palette.onSurface,
    fontSize: 44,
    letterSpacing: -1.3,
    fontFamily: "Inter_800ExtraBold",
  },
  headerAvatarPressable: {
    borderRadius: 17,
  },
  headerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "rgba(186,158,255,0.3)",
  },
  main: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 112,
    paddingBottom: 28,
    alignItems: "center",
  },
  avatarsWrap: {
    width: 320,
    height: 210,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    marginBottom: 26,
  },
  pulseRingOne: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(186,158,255,0.2)",
    transform: [{ scale: 1.5 }],
  },
  pulseRingTwo: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(186,158,255,0.1)",
    transform: [{ scale: 1.95 }],
  },
  avatarLeftWrap: {
    position: "absolute",
    left: 42,
    zIndex: 20,
  },
  avatarRightWrap: {
    position: "absolute",
    right: 42,
    transform: [{ translateY: -8 }, { translateX: 8 }],
    zIndex: 10,
  },
  avatarGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    backgroundColor: "rgba(186,158,255,0.25)",
    transform: [{ scale: 1.08 }],
  },
  avatarImage: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 4,
    borderColor: palette.background,
  },
  boltBadge: {
    position: "absolute",
    bottom: 26,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: palette.primary,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    zIndex: 30,
  },
  copyWrap: {
    alignItems: "center",
    marginTop: 8,
    marginBottom: 28,
  },
  detailsRow: {
    width: "100%",
    maxWidth: 340,
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  userDetailCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  userDetailName: {
    color: palette.onSurface,
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  userDetailMeta: {
    marginTop: 2,
    color: palette.primary,
    fontSize: 10,
    letterSpacing: 0.8,
    fontFamily: "Inter_700Bold",
  },
  userDetailMetaSecondary: {
    marginTop: 2,
    color: palette.onSurfaceVariant,
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  matchTitle: {
    color: palette.onSurface,
    textAlign: "center",
    textTransform: "uppercase",
    fontSize: 56,
    lineHeight: 50,
    letterSpacing: -1.6,
    fontFamily: "Inter_900Black",
  },
  matchAccent: {
    color: palette.primary,
    fontStyle: "italic",
  },
  matchSubtitle: {
    marginTop: 16,
    textAlign: "center",
    color: palette.onSurfaceVariant,
    fontSize: 17,
    lineHeight: 24,
    fontFamily: "Inter_500Medium",
  },
  matchName: {
    color: palette.onSurface,
    fontFamily: "Inter_700Bold",
  },
  actionWrap: {
    width: "100%",
    maxWidth: 320,
    gap: 12,
  },
  primaryCta: {
    height: 56,
    borderRadius: 999,
    backgroundColor: palette.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: palette.primary,
    shadowOpacity: 0.24,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  primaryCtaText: {
    color: palette.onPrimary,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
  },
  secondaryCta: {
    height: 56,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryCtaText: {
    color: palette.onSurface,
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  footerWrap: {
    marginTop: "auto",
    paddingTop: 14,
  },
  footerText: {
    color: "rgba(173,170,170,0.35)",
    textTransform: "uppercase",
    letterSpacing: 2,
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.97 }],
  },
});
