import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ALPHA_COLORS, APP_COLORS } from "../constants/theme";

type NavTab = "discover" | "matches" | "profile" | "settings";

type MainBottomNavProps = {
  activeTab: NavTab;
  bottomInset: number;
  onOpenDiscover?: () => void;
  onOpenMatches?: () => void;
  onOpenProfile?: () => void;
  onOpenSettings?: () => void;
};

type NavItem = {
  key: NavTab;
  label: string;
  icon: "explore" | "favorite" | "person" | "settings";
  onPress?: () => void;
};

export function MainBottomNav({
  activeTab,
  bottomInset,
  onOpenDiscover,
  onOpenMatches,
  onOpenProfile,
  onOpenSettings,
}: MainBottomNavProps) {
  const items: NavItem[] = [
    {
      key: "discover",
      label: "Discover",
      icon: "explore",
      onPress: onOpenDiscover,
    },
    {
      key: "matches",
      label: "Matches",
      icon: "favorite",
      onPress: onOpenMatches,
    },
    {
      key: "profile",
      label: "Profile",
      icon: "person",
      onPress: onOpenProfile,
    },
    {
      key: "settings",
      label: "Settings",
      icon: "settings",
      onPress: onOpenSettings,
    },
  ];

  return (
    <View style={[styles.bottomNavWrap, { paddingBottom: bottomInset + 6 }]}>
      <View style={styles.bottomNav}>
        {items.map((item) => {
          const isActive = item.key === activeTab;
          return (
            <Pressable
              key={item.key}
              onPress={isActive ? undefined : item.onPress}
              style={isActive ? styles.navItemActive : styles.navItem}
              disabled={isActive || !item.onPress}
            >
              {isActive ? <View style={styles.navActiveBg} /> : null}
              <MaterialIcons
                name={item.icon}
                size={22}
                color={
                  isActive
                    ? APP_COLORS.primaryStrong
                    : ALPHA_COLORS.navIconMuted
                }
                style={isActive ? styles.navActiveIcon : undefined}
              />
              <Text style={isActive ? styles.navLabelActive : styles.navLabel}>
                {item.label}
              </Text>
              {isActive ? <View style={styles.navActiveDot} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNavWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  bottomNav: {
    width: "100%",
    maxWidth: 440,
    borderRadius: 30,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: ALPHA_COLORS.navBackground,
    borderWidth: 1,
    borderColor: ALPHA_COLORS.navBorder,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  navItem: {
    flex: 1,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  navItemActive: {
    position: "relative",
    flex: 1,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  navActiveBg: {
    position: "absolute",
    top: 2,
    bottom: 2,
    left: 4,
    right: 4,
    borderRadius: 14,
    backgroundColor: ALPHA_COLORS.navActiveBg,
  },
  navActiveIcon: {
    zIndex: 2,
  },
  navLabel: {
    marginTop: 1,
    color: ALPHA_COLORS.navLabelMuted,
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    fontFamily: "Inter_700Bold",
  },
  navLabelActive: {
    marginTop: 1,
    color: APP_COLORS.primaryStrong,
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    fontFamily: "Inter_800ExtraBold",
    zIndex: 2,
  },
  navActiveDot: {
    marginTop: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: APP_COLORS.primaryStrong,
    zIndex: 2,
  },
});
