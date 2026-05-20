import React from 'react';
import { Animated, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Surface, Text } from 'react-native-paper';
import { useAppTheme } from '../../theme/useAppTheme';
import { StatusBadge, StatusBanner, textStyles } from '../../components/AppUi';
import { radius, spacing } from '../../theme/designTokens';

type OnboardingHighlight = {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
};

type OnboardingStatusPanel = {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  body: string;
  tone: 'info' | 'success' | 'warning';
};

type OnboardingPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  note?: string;
  heroIcon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  heroLabel: string;
  heroBadges: string[];
  highlights: OnboardingHighlight[];
  statusPanel?: OnboardingStatusPanel;
  visualAnimatedStyle?: Animated.WithAnimatedValue<ViewStyle>;
  copyAnimatedStyle?: Animated.WithAnimatedValue<ViewStyle>;
  detailsAnimatedStyle?: Animated.WithAnimatedValue<ViewStyle>;
  extraContent?: React.ReactNode;
};

export function OnboardingPage({
  eyebrow,
  title,
  description,
  note,
  heroIcon,
  heroLabel,
  heroBadges,
  highlights,
  statusPanel,
  visualAnimatedStyle,
  copyAnimatedStyle,
  detailsAnimatedStyle,
  extraContent
}: OnboardingPageProps) {
  const theme = useAppTheme();

  return (
    <ScrollView 
      style={styles.page} 
      contentContainerStyle={styles.scrollContent} 
      showsVerticalScrollIndicator={false}
    >
      <Animated.View style={visualAnimatedStyle}>
        <Surface
          elevation={0}
          style={[
            styles.heroShell,
            {
              backgroundColor: theme.colors.primaryContainer,
              borderColor: theme.colors.primary
            }
          ]}
        >
          <Surface
            elevation={1}
            style={[
              styles.heroCore,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.outlineVariant
              }
            ]}
          >
            <View style={[styles.heroIconWrap, { backgroundColor: theme.colors.primaryContainer }]}>
              <MaterialCommunityIcons name={heroIcon} size={38} color={theme.colors.primary} />
            </View>
            <Text variant="titleMedium" style={[textStyles.start, { color: theme.colors.onSurface }]}>
              {heroLabel}
            </Text>
          </Surface>
          <View style={styles.heroBadgeRow}>
            <StatusBadge label={heroBadges[0]} selected />
            <StatusBadge label={heroBadges[1]} />
          </View>
        </Surface>
      </Animated.View>

      <Animated.View style={[styles.copyBlock, copyAnimatedStyle]}>
        <Text
          variant="labelLarge"
          style={[
            styles.eyebrow,
            {
              color: theme.colors.primary,
              textAlign: 'auto'
            }
          ]}
        >
          {eyebrow}
        </Text>
        <Text
          variant="headlineMedium"
          style={[
            styles.title,
            {
              color: theme.colors.onBackground,
              textAlign: 'auto'
            }
          ]}
        >
          {title}
        </Text>
        <Text
          variant="bodyLarge"
          style={[
            styles.description,
            {
              color: theme.colors.onSurfaceVariant,
              textAlign: 'auto'
            }
          ]}
        >
          {description}
        </Text>
      </Animated.View>

      <Animated.View style={[styles.detailsBlock, detailsAnimatedStyle]}>
        <View style={styles.highlightList}>
          {highlights.map((highlight) => (
            <Surface
              key={highlight.label}
              elevation={0}
              style={[
                styles.highlightCard,
                {
                  backgroundColor: theme.colors.surfaceContainerHigh ?? theme.colors.surfaceVariant,
                  borderColor: theme.colors.outlineVariant
                }
              ]}
            >
              <MaterialCommunityIcons name={highlight.icon} size={18} color={theme.colors.secondary} />
              <Text variant="bodyMedium" style={[styles.flex, textStyles.start]}>
                {highlight.label}
              </Text>
            </Surface>
          ))}
        </View>

        {statusPanel ? (
          <StatusBanner tone={statusPanel.tone} icon={statusPanel.icon} title={statusPanel.title} body={statusPanel.body} />
        ) : null}

        {note ? (
          <Text
            variant="bodyMedium"
            style={[
              styles.note,
              {
                color: theme.colors.onSurfaceVariant,
                textAlign: 'auto'
              }
            ]}
          >
            {note}
          </Text>
        ) : null}
        {extraContent}
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1
  },
  scrollContent: {
    gap: spacing.section,
    paddingBottom: spacing.section
  },
  heroShell: {
    minHeight: 246,
    borderRadius: radius.largeCard,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    justifyContent: 'center',
    paddingHorizontal: spacing.innerCard,
    paddingVertical: spacing.innerCard,
    gap: spacing.gap
  },
  heroCore: {
    alignSelf: 'center',
    alignItems: 'center',
    gap: spacing.gap,
    minWidth: 210,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.innerCard,
    paddingVertical: spacing.innerCard
  },
  heroIconWrap: {
    width: 78,
    height: 78,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center'
  },
  heroBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.smallGap
  },
  copyBlock: {
    gap: spacing.smallGap
  },
  eyebrow: {
    fontWeight: '700',
    letterSpacing: 0.4
  },
  title: {
    fontWeight: '800',
    letterSpacing: 0
  },
  description: {
    lineHeight: 26
  },
  detailsBlock: {
    gap: spacing.gap
  },
  highlightList: {
    gap: spacing.smallGap
  },
  highlightCard: {
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.gap,
    paddingHorizontal: spacing.compactInner,
    paddingVertical: spacing.compactInner
  },
  note: {
    lineHeight: 22
  },
  flex: {
    flex: 1
  }
});
