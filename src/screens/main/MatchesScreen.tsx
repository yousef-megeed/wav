import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/inter";
import { MaterialIcons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
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
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { MainBottomNav } from "../../components/MainBottomNav";
import { APP_COLORS } from "../../constants/theme";

type MatchesScreenProps = {
  newMatches?: MatchAvatar[];
  conversations?: Conversation[];
  isLoading?: boolean;
  profileAvatarUrl?: string | null;
  onOpenDiscover?: () => void;
  onOpenProfile?: () => void;
  onOpenChat?: (conversationId: string) => void;
  onOpenSettings?: () => void;
};

type MatchAvatar = {
  id: string;
  name: string;
  imageUrl: string;
  isNew?: boolean;
};

type Conversation = {
  id: string;
  name: string;
  message: string;
  time: string;
  imageUrl: string;
  isOnline?: boolean;
  statusText?: string;
  unread?: boolean;
};

const palette = {
  background: APP_COLORS.backgroundStrong,
  surfaceContainer: APP_COLORS.surfaceLow,
  surfaceContainerHigh: APP_COLORS.surfaceHigh,
  onSurface: APP_COLORS.textPrimary,
  onSurfaceVariant: APP_COLORS.textSecondary,
  primary: APP_COLORS.primaryStrong,
  successBright: APP_COLORS.successBright,
};

const FALLBACK_PROFILE_AVATAR =
  "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?q=80&w=512&auto=format&fit=crop";

const DEFAULT_NEW_MATCHES: MatchAvatar[] = [
  {
    id: "elara",
    name: "ELARA",
    isNew: true,
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDGufERsKi4jrDLnpD4jy1PJEY7_RrrhIW4QRgcgEr2tubusOo7Febu7Jk-AGMbAcwowOhv_Xc5c7QFWpF-l1E65QFaS8pGiVa_5QAk3jkIrlCDTUTIurjmAT4S6BniXOmKhGc0VHbHQ0Ua6nrvOwIqfkfs9Ug_lZMY-CLmofwk_9YXvshdW1bLlBlE0N6NtEahPd-evMtUO732fvqxfD2bc3bHWDVgYWcswuIuQ6aiPoZtBuJ2n0Qov07Nk9GekRM0pUntq12vhV8O",
  },
  {
    id: "marcus",
    name: "MARCUS",
    isNew: true,
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBgm8IGW3el5H1Oo42wI6aeu1BXLpI9lTyQsZfXyObcR8ZTe2E9DQspOWaizLtO0Vb6onUNZnfGI0_X2hUDWEi6xB-ePP5s2vdefCC5FhjWJTrvHx6-bQezeGOQ_eUdqXvevvQ697pQKVDzbhW0by1M0hT-VwGln7tyFW-hmJKBjyhkQOSVxFF-METJ5h0yxS4bhi7PvXTR0rjcauXgyS03CoitC1fScNHAuhDCA2xVKyDVWk6GeGUAyqbB4dqxxqUn34IrPLH97CJ8",
  },
  {
    id: "jade",
    name: "JADE",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuC8aZK8OnZv9QUFMmXlD1SvjNOLbjk8CNl5So1nb7oalBQWWdDYZ3Pf2sIHaA791HTIrDRoaxJRwcF-ukLYTModizWKYImSqTN8tbvq5NCD9XlhRKerqpFBCR5xW6TNqe9Do1zgvhi-Og-40HW2xZapgfN18xQakHMMB0pMcYWkd_4NgHoxKPtv5NiHPxy5c5aF1o1Cc-321U2dGJ4gcHieBkJ914a7sxNfxKyRnaA3N0DvPii7_nZzEMtOyAH1vfhnrsSlm55_5Y5u",
  },
  {
    id: "remy",
    name: "REMY",
    isNew: true,
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCjMfPZ5du9KoW6KKzOG7nPZZfLQqS-yqN0pY5DWEwMGm0-mUWp_InCFOtONED6YLp7YJLGvlU1gIELkiQWW9nzvPt2JVUqDxru6zqLJScnPfyMFEoyzAQ2CH8VQ851YytFc6CS5kMzzVK_ZCoYUu-NZR84PiHEmrefmpvLtxRjMAHfOqQZ26FUhii8r0rNZzZC9z96QCvIbWVvEQogpJo4NxXkPugMVKOmFB6jrkDN82_jez5egw5Xw4AnP9Mm8zjtBgtRPYu87eyx",
  },
];

const DEFAULT_CONVERSATIONS: Conversation[] = [
  {
    id: "julian-vox",
    name: "Julian Vox",
    time: "14:20",
    unread: true,
    message:
      "That bridge section is sounding incredible! Want to try a new synth layer?",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuB0sl0BdMAWSqTfGFxl3IT1qjUgJvfstpPgJMcAnHBRxANZabNYdAI_gJlMHoOH121MzI2bN-8iGi7BbtzyDJQ0bX_q-mZEDDTDDp6cFL5mmW25UDDlo3PBKKpw-GKamFBeoejsI_JyBrnHYZ-5t_S50r5Zh5Cfc0Vs7bl7rax7vwT4Oigv-0noEk74NpMyyL46-vg3clcUskwmdEg3DxfSG8R5RFT8_Z1eky4NwkH2yLmcmLrUy0uZGO6aBip0oNG7qUiz4K1zV6QX",
  },
  {
    id: "mia-strings",
    name: "Mia Strings",
    time: "10:05",
    message:
      "Sent you the raw stems for the cello solo. Let me know what you think.",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBU-caKwjI0JFjHw6E2sFYAap6gbLvB0zzWWyl1XFJIg4vdiBTPxwCw2D1A2OVIiyVLPt9Njsrxcm037bmOr3unRtcMoEXytn4xRCCHHYSmZ1QU6Bs1y4CXk47-PEXfR9t6TNh3tY0aBgdE58smvJxLtqZiWBL63iSU8OsYdqxfcjLGcnaVLN1MYPShV0jLDjHHeRvL-JQf6qA5zW39JYCe-ZfsLrLPUEfilpqaortp9E2P2C8cyDwSyrGvM9L3B1saWwX_50ivlarU",
  },
  {
    id: "nova-project",
    name: "Nova Project",
    time: "YESTERDAY",
    message:
      "The deadline for the remix competition is Friday. We should finalize it.",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuB6hp5k_qmHNq957XueaLUxQe_J5YnIbI0aWq0i0DBIVV_hZDNlboWORUhfqgzCTFzIsM4Fq4ALiom2DAWjbACh3_71iw1Fb1S-A_ovFn1CCYzVT4S8EnTXIPBjyVK5j_H5zY0GEHPfHF4f3Vv6ZeeO8y3jxBE496kfzciUGRGYyX8jbDDKnrj8N7HEp5wV8iiD0SAcTLTFXqHO9kt8AuPeq3Zvobw3TR1BJ863d7kugD087MEr5kLpxVbggFwZMLEc6gYDrGg535c7",
  },
];

export function MatchesScreen({
  newMatches,
  conversations,
  isLoading,
  profileAvatarUrl,
  onOpenDiscover,
  onOpenProfile,
  onOpenChat,
  onOpenSettings,
}: MatchesScreenProps) {
  const insets = useSafeAreaInsets();
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator color={palette.primary} size="large" />
      </View>
    );
  }

  const matchItems = newMatches ?? DEFAULT_NEW_MATCHES;
  const conversationItems = conversations ?? DEFAULT_CONVERSATIONS;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Matches</Text>
        </View>

        <View style={styles.userAvatarWrap}>
          <Image
            source={{
              uri: profileAvatarUrl ?? FALLBACK_PROFILE_AVATAR,
            }}
            style={styles.userAvatar}
          />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: insets.bottom + 104 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.searchWrap}>
          <MaterialIcons
            name="search"
            size={20}
            color="rgba(173,170,170,0.4)"
            style={styles.searchIcon}
          />
          <TextInput
            placeholder="Search collaborations..."
            placeholderTextColor="rgba(173,170,170,0.3)"
            style={styles.searchInput}
          />
        </View>

        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeader}>
            <Text style={styles.newMatchesLabel}>New Matches</Text>
            <Text style={styles.viewAllLabel}>View All</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.matchesRow}
          >
            {matchItems.map((item) => {
              const ringStyle = item.isNew
                ? styles.newMatchRing
                : styles.oldMatchRing;
              return (
                <Pressable key={item.id} style={styles.matchItem}>
                  <View style={[styles.matchRing, ringStyle]}>
                    <View style={styles.matchAvatarWrap}>
                      <Image
                        source={{ uri: item.imageUrl }}
                        style={styles.matchAvatar}
                      />
                    </View>
                    {item.isNew ? <View style={styles.onlineDot} /> : null}
                  </View>
                  <Text style={styles.matchName}>{item.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.sectionWrap}>
          <Text style={styles.recentLabel}>Recent Conversations</Text>

          <View style={styles.conversationList}>
            {isLoading ? (
              <View style={styles.chatEmptyState}>
                <ActivityIndicator color={palette.primary} />
                <Text style={styles.chatEmptyText}>
                  Loading conversations...
                </Text>
              </View>
            ) : conversationItems.length === 0 ? (
              <View style={styles.chatEmptyState}>
                <Text style={styles.chatEmptyText}>
                  No matches yet. Keep swiping in Discover.
                </Text>
              </View>
            ) : (
              conversationItems.map((chat) => (
                <Pressable
                  key={chat.id}
                  onPress={() => onOpenChat?.(chat.id)}
                  style={({ pressed }) => [
                    styles.chatCard,
                    pressed && styles.cardPressed,
                  ]}
                >
                  <View style={styles.chatAvatarWrap}>
                    <Image
                      source={{ uri: chat.imageUrl }}
                      style={styles.chatAvatar}
                    />
                  </View>

                  <View style={styles.chatContent}>
                    <View style={styles.chatTopRow}>
                      <View style={styles.chatNameStatusWrap}>
                        <Text style={styles.chatName}>{chat.name}</Text>
                        <View style={styles.presenceRow}>
                          <View
                            style={[
                              styles.presenceDot,
                              chat.isOnline
                                ? styles.presenceDotOnline
                                : styles.presenceDotOffline,
                            ]}
                          />
                          <Text
                            style={[
                              styles.presenceText,
                              chat.isOnline
                                ? styles.presenceTextOnline
                                : styles.presenceTextOffline,
                            ]}
                            numberOfLines={1}
                          >
                            {chat.statusText ??
                              (chat.isOnline ? "Active now" : "Offline")}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.chatTime}>{chat.time}</Text>
                    </View>
                    <Text numberOfLines={1} style={styles.chatMessage}>
                      {chat.message}
                    </Text>
                  </View>

                  {chat.unread ? <View style={styles.unreadDot} /> : null}
                </Pressable>
              ))
            )}
          </View>
        </View>
      </ScrollView>

      <MainBottomNav
        activeTab="matches"
        bottomInset={insets.bottom}
        onOpenDiscover={onOpenDiscover}
        onOpenProfile={onOpenProfile}
        onOpenSettings={onOpenSettings}
      />
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
    paddingBottom: 12,
    minHeight: 92,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.03)",
    backgroundColor: "rgba(8,8,8,0.72)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerTitle: {
    color: palette.onSurface,
    fontSize: 44,
    letterSpacing: -1.3,
    fontFamily: "Inter_800ExtraBold",
  },
  userAvatarWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.2)",
  },
  userAvatar: {
    width: "100%",
    height: "100%",
  },
  scroll: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: 94,
    paddingHorizontal: 24,
  },
  searchWrap: {
    position: "relative",
    marginBottom: 34,
  },
  searchIcon: {
    position: "absolute",
    left: 14,
    top: 15,
    zIndex: 2,
  },
  searchInput: {
    height: 56,
    borderRadius: 16,
    backgroundColor: palette.surfaceContainer,
    color: palette.onSurface,
    paddingLeft: 46,
    paddingRight: 16,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  sectionWrap: {
    marginBottom: 34,
  },
  sectionHeader: {
    marginBottom: 18,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  newMatchesLabel: {
    color: palette.primary,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.7,
    fontFamily: "Inter_700Bold",
  },
  viewAllLabel: {
    color: "rgba(173,170,170,0.6)",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontFamily: "Inter_500Medium",
  },
  matchesRow: {
    gap: 22,
    paddingBottom: 2,
  },
  matchItem: {
    alignItems: "center",
    gap: 10,
  },
  matchRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    padding: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  newMatchRing: {
    backgroundColor: palette.primary,
  },
  oldMatchRing: {
    backgroundColor: palette.surfaceContainerHigh,
  },
  matchAvatarWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: palette.background,
  },
  matchAvatar: {
    width: "100%",
    height: "100%",
  },
  onlineDot: {
    position: "absolute",
    right: 3,
    bottom: 3,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: palette.background,
    backgroundColor: palette.primary,
  },
  matchName: {
    color: palette.onSurfaceVariant,
    fontSize: 11,
    letterSpacing: 1.3,
    fontFamily: "Inter_700Bold",
  },
  recentLabel: {
    marginBottom: 16,
    color: "rgba(173,170,170,0.6)",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.7,
    fontFamily: "Inter_700Bold",
  },
  conversationList: {
    gap: 10,
  },
  chatEmptyState: {
    borderRadius: 16,
    backgroundColor: palette.surfaceContainer,
    paddingHorizontal: 16,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  chatEmptyText: {
    color: palette.onSurfaceVariant,
    textAlign: "center",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  chatCard: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.02)",
    backgroundColor: palette.surfaceContainer,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  chatAvatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  chatAvatar: {
    width: "100%",
    height: "100%",
  },
  chatContent: {
    flex: 1,
    minWidth: 0,
  },
  chatTopRow: {
    marginBottom: 3,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
  },
  chatNameStatusWrap: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  chatName: {
    color: palette.onSurface,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  presenceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  presenceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  presenceDotOnline: {
    backgroundColor: palette.successBright,
  },
  presenceDotOffline: {
    backgroundColor: "rgba(173,170,170,0.45)",
  },
  presenceText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  presenceTextOnline: {
    color: palette.successBright,
  },
  presenceTextOffline: {
    color: "rgba(173,170,170,0.62)",
  },
  chatTime: {
    color: "rgba(173,170,170,0.4)",
    fontSize: 10,
    fontFamily: "Inter_500Medium",
  },
  chatMessage: {
    color: "rgba(173,170,170,0.82)",
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.primary,
  },
  cardPressed: {
    backgroundColor: palette.surfaceContainerHigh,
    transform: [{ scale: 0.98 }],
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.96 }],
  },
});
