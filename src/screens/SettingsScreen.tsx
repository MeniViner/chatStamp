import React from 'react';
import { BackHandler, Linking, ScrollView, StyleSheet, View } from 'react-native';
import * as Application from 'expo-application';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Snackbar, Text } from 'react-native-paper';
import { BottomSheet } from '../components/BottomSheet';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SettingsCategoryPanel } from '../components/SettingsCategoryPanel';
import { openAppLanguageSettings } from '../native/appLanguage';
import { openOutputFolderPicker } from '../native/outputFolderPicker';
import { usePipelineStore } from '../store/pipelineStore';
import { useHistoryStore } from '../store/historyStore';
import { useOnboardingStore } from '../store/onboardingStore';
import { useSettingsStore, type AppSettingsPatch } from '../store/settingsStore';
import { syncI18nLanguage } from '../i18n';
import { useLanguageRestartStore } from '../store/languageRestartStore';
import { discardImport } from '../services/operationCoordinator';
import { getChatStampNativeModule } from '../native/chatStampNativeModule';
import { useAppTheme } from '../theme/useAppTheme';
import { WizardScreen } from './WizardScreen';
import { useTranslation } from 'react-i18next';
import type { AppLanguagePreference, AppSettings, DuplicateHandlingMode, OutputOrganizationMode } from '../types/media';
import {
  InfoRow,
  OptionChoiceCard,
  PrimaryButton,
  SecondaryButton,
  SettingsSectionCard,
  SettingRow as UiSettingRow,
  textStyles
} from '../components/AppUi';
import { spacing } from '../theme/designTokens';

const organizationModes: OutputOrganizationMode[] = ['all-in-one', 'by-type', 'by-sender', 'by-sender-and-type'];
const duplicateModes: DuplicateHandlingMode[] = ['keep-both', 'skip-existing', 'replace-existing'];
const languageOptions: AppLanguagePreference[] = ['system', 'en', 'he'];
type SettingsCategory = 'saving' | 'language' | 'appearance' | 'storage' | 'help' | 'advanced';

export function SettingsScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const settings = useSettingsStore((state) => state.settings);
  const updateSettings = useSettingsStore((state) => state.updateSettings);
  const resetSaveLocation = useSettingsStore((state) => state.resetSaveLocation);
  const closeOverlayStage = usePipelineStore((state) => state.closeOverlayStage);
  const requestOnboardingReplay = useOnboardingStore((state) => state.requestReplay);
  const clearHistory = useHistoryStore((state) => state.clearHistory);
  const [snackbar, setSnackbar] = React.useState<string | undefined>();
  const [clearCacheOpen, setClearCacheOpen] = React.useState(false);
  const [clearHistoryOpen, setClearHistoryOpen] = React.useState(false);
  const [languageBusy, setLanguageBusy] = React.useState(false);
  const languageReserved = React.useRef(false);
  const restartRequired = useLanguageRestartStore((state) => state.required);
  const [organizationSheetOpen, setOrganizationSheetOpen] = React.useState(false);
  const [category, setCategory] = React.useState<SettingsCategory | null>(null);
  const categories = [
    { id: 'saving', title: t('settings.categories.saving.title'), summary: t('settings.categories.saving.summary'), icon: 'folder-cog-outline' },
    { id: 'language', title: t('settings.language'), summary: t('settings.categories.language.summary'), icon: 'translate' },
    { id: 'appearance', title: t('settings.appearance'), summary: t('settings.categories.appearance.summary'), icon: 'theme-light-dark' },
    { id: 'storage', title: t('settings.categories.storage.title'), summary: t('settings.categories.storage.summary'), icon: 'history' },
    { id: 'help', title: t('settings.categories.help.title'), summary: t('settings.categories.help.summary'), icon: 'help-circle-outline' },
    { id: 'advanced', title: t('settings.categories.advanced.title'), summary: t('settings.categories.advanced.summary'), icon: 'tune-variant' }
  ] as const;
  const currentCategory = categories.find((entry) => entry.id === category);

  const goBack = React.useCallback(() => {
    if (organizationSheetOpen) setOrganizationSheetOpen(false);
    else if (clearCacheOpen) setClearCacheOpen(false);
    else if (clearHistoryOpen) setClearHistoryOpen(false);
    else if (category !== null) setCategory(null);
    else closeOverlayStage('welcome');
  }, [category, clearCacheOpen, clearHistoryOpen, closeOverlayStage, organizationSheetOpen]);

  React.useEffect(() => {
    const backSubscription = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });
    return () => {
      backSubscription.remove();
    };
  }, [goBack]);

  async function saveSettings(patch: AppSettingsPatch) {
    try { await updateSettings(patch); } catch { setSnackbar(t('settings.saveFailed')); }
  }

  async function chooseFolder() {
    try {
      const folder = await openOutputFolderPicker();
      if (!folder) return;
      if (!folder.persistedPermission) {
        setSnackbar(t('settings.folderPickFailed'));
        return;
      }
      await updateSettings({
        saveDestinationMode: 'custom-folder',
        useDefaultFolder: false,
        customFolder: folder,
        customFolderTimestampSupport: null
      });
    } catch {
      setSnackbar(t('settings.folderPickFailed'));
    }
  }

  async function applyLanguagePreference(languagePreference: AppLanguagePreference) {
    if (languageReserved.current) return;
    languageReserved.current = true; setLanguageBusy(true);
    try {
      await updateSettings({ languagePreference });
      const required = await syncI18nLanguage(languagePreference);
      useLanguageRestartStore.getState().setRequired(required, required);
    } catch {
      setSnackbar(t('settings.saveFailed'));
    } finally {
      languageReserved.current = false; setLanguageBusy(false);
    }
  }

  async function clearCache() {
    try {
      if (usePipelineStore.getState().workingDirectory) await discardImport();
      await getChatStampNativeModule().cleanupStaleJobsAsync();
      setSnackbar(t('settings.cacheClearedBody'));
    } catch {
      setSnackbar(t('settings.couldNotClearCache'));
    } finally {
      setClearCacheOpen(false);
    }
  }

  async function confirmClearHistory() {
    try {
      await clearHistory();
      setClearHistoryOpen(false);
      setSnackbar(t('settings.historyCleared'));
    } catch { setSnackbar(t('settings.saveFailed')); }
  }

  async function openSupportLink(url: string) {
    try { await Linking.openURL(url); } catch { setSnackbar(t('settings.couldNotOpenLink')); }
  }

  return (
    <WizardScreen
      stage="settings"
      title={currentCategory?.title ?? t('settings.title')}
      subtitle={currentCategory?.summary ?? t('settings.subtitle')}
      onBack={goBack}
    >
      <ScrollView key={category ?? 'menu'} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {category === null ? categories.map((entry) => <SettingsCategoryPanel key={entry.id}
          title={entry.title} summary={entry.summary} icon={entry.icon} onPress={() => setCategory(entry.id)} />) : null}
        {category === 'saving' ? <>
        <Section title={t('settings.saveLocation')} icon="folder-cog-outline">
          <DestinationCard
            title={t('settings.defaultAccurateFolder')}
            description={t('settings.defaultAccurateFolderBody')}
            selected={settings.saveDestinationMode === 'default-accurate-folder'}
            badge={t('settings.recommended')}
            onPress={() =>
              void saveSettings({
                saveDestinationMode: 'default-accurate-folder',
                useDefaultFolder: true
              })
            }
          />
          <DestinationCard
            title={t('settings.customFolder')}
            description={
              settings.customFolder?.readablePathLabel ??
              settings.customFolder?.displayName ??
              t('settings.customFolderBody')
            }
            selected={settings.saveDestinationMode === 'custom-folder'}
            onPress={() => void chooseFolder()}
          />
          <View style={styles.compactButtonRow}>
            <SecondaryButton icon="folder-plus-outline" style={styles.compactButton} onPress={() => void chooseFolder()}>
              {t('settings.chooseFolder')}
            </SecondaryButton>
            <SecondaryButton style={styles.compactButton} onPress={() => { void resetSaveLocation().catch(() => setSnackbar(t('settings.saveFailed'))); }}>
              {t('settings.resetToDefault')}
            </SecondaryButton>
          </View>
          {settings.saveDestinationMode === 'custom-folder' ? (
            <Detail icon="calendar-outline" label={t('settings.customFolderDateAccuracy')} value={t('settings.customFolderDateBody')} />
          ) : null}
          <UiSettingRow
            icon="calendar-sync-outline"
            title={t('settings.alwaysUseMessageDate')}
            description={t('settings.alwaysUseMessageDateBody')}
            value={settings.alwaysUseMessageDate}
            onValueChange={(alwaysUseMessageDate) => void saveSettings({ alwaysUseMessageDate })}
          />
          <Detail icon="folder-outline" label={t('settings.lastOutputFolder')} value={settings.lastOutputFolder ?? t('settings.noneYet')} path />
        </Section>

        <Section title={t('settings.outputOrg')} icon="folder-multiple-outline">
          <View style={styles.summaryRow}>
            <Text variant="titleSmall" numberOfLines={2} style={[styles.flex, textStyles.start]}>
              {t(`settings.organizationModes.${settings.outputOrganization.mode}.title`)}
            </Text>
            <SecondaryButton style={styles.compactAction} onPress={() => setOrganizationSheetOpen(true)}>
              {t('settings.change')}
            </SecondaryButton>
          </View>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {getOrganizationSummaryText(t, settings.outputOrganization)}
          </Text>
          <UiSettingRow
            title={t('settings.createExportTimestampFolder')}
            value={settings.outputOrganization.createExportTimestampFolder}
            onValueChange={(value) =>
              void saveSettings({
                outputOrganization: { createExportTimestampFolder: value }
              })
            }
          />
          <Text variant="labelLarge">{t('settings.duplicateHandling')}</Text>
          <View style={styles.choiceList}>
            {duplicateModes.map((mode) => (
              <OptionChoiceCard
                key={mode}
                title={t(`settings.duplicateModes.${mode}`)}
                description={t(`outputOptions.duplicateModes.${mode}.body`)}
                selected={settings.outputOrganization.duplicateHandling === mode}
                caution={mode === 'replace-existing'}
                onPress={() =>
                  void saveSettings({
                    outputOrganization: { duplicateHandling: mode }
                  })
                }
              />
            ))}
          </View>
        </Section>
        </> : null}

        {category === 'language' ?
        <Section title={t('settings.language')} icon="translate">
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {t('settings.languageInfo')}
          </Text>
          {restartRequired ? <SecondaryButton icon="restart" onPress={() => useLanguageRestartStore.getState().requestPrompt()}>{t('languageRestart.now')}</SecondaryButton> : null}
          <View style={styles.choiceList}>
            {languageOptions.map((languagePreference) => (
              <OptionChoiceCard
                key={languagePreference}
                title={t(`settings.languageOptions.${languagePreference}`)}
                description={t(`settings.languageBodies.${languagePreference}`)}
                selected={settings.languagePreference === languagePreference}
                disabled={languageBusy}
                onPress={() => void applyLanguagePreference(languagePreference)}
              />
            ))}
          </View>
          <SecondaryButton
            icon="android"
            onPress={async () => {
              const outcome = await openAppLanguageSettings();
              if (outcome === 'opened-system-settings') {
                setSnackbar(t('settings.languageSettingsFallbackOpened'));
              } else if (outcome === 'unsupported') {
                setSnackbar(t('settings.languageSystemFallback'));
              }
            }}
          >
            {t('settings.openAppLanguageSettings')}
          </SecondaryButton>
        </Section>
        : null}

        {category === 'appearance' ?
        <Section title={t('settings.appearance')} icon="theme-light-dark">
          <View style={styles.choiceList}>
            <OptionChoiceCard
              title={t('settings.systemDefault')}
              description={t('settings.appearanceBodies.system')}
              selected={settings.appearance === 'system'}
              onPress={() => void saveSettings({ appearance: 'system' })}
            />
            <OptionChoiceCard
              title={t('settings.light')}
              description={t('settings.appearanceBodies.light')}
              selected={settings.appearance === 'light'}
              onPress={() => void saveSettings({ appearance: 'light' })}
            />
            <OptionChoiceCard
              title={t('settings.dark')}
              description={t('settings.appearanceBodies.dark')}
              selected={settings.appearance === 'dark'}
              onPress={() => void saveSettings({ appearance: 'dark' })}
            />
          </View>
          <UiSettingRow
            title={t('settings.dynamicColors')}
            description={t('settings.dynamicColorsBody')}
            value={settings.useDynamicColors}
            onValueChange={(value) => void saveSettings({ useDynamicColors: value })}
          />
        </Section>
        : null}

        {category === 'help' ? <>
        <Section title={t('settings.privacySupport')} icon="shield-account-outline">
          <Text variant="bodyMedium" style={textStyles.start}>{t('settings.privacySummary')}</Text>
          <SecondaryButton icon="shield-lock-outline" onPress={() => void openSupportLink('https://meniviner.github.io/chatStamp/privacy-policy.html')}>
            {t('settings.privacyPolicy')}
          </SecondaryButton>
          <SecondaryButton icon="email-outline" onPress={() => void openSupportLink('mailto:menis10tec@gmail.com')}>
            {t('settings.contactSupport')}
          </SecondaryButton>
        </Section>

        <Section title={t('settings.appOptions')} icon="tune-variant">
          <Detail icon="star-four-points-outline" label={t('settings.welcomeTour')} value={t('settings.welcomeTourBody')} />
          <SecondaryButton
            icon="play-circle-outline"
            onPress={() => {
              requestOnboardingReplay();
            }}
          >
            {t('settings.showWelcomeTourAgain')}
          </SecondaryButton>
          <Detail
            icon="information-outline"
            label={t('settings.versionBuild')}
            value={`${Application.nativeApplicationVersion ?? '0.1.0'} (${Application.nativeBuildVersion ?? t('settings.devBuild')})`}
          />
        </Section>
        </> : null}

        {category === 'advanced' ?
        <Section title={t('settings.developerMode')} icon="tune-variant">
          <UiSettingRow
            title={t('settings.developerModeToggle')}
            description={t('settings.developerModeBody')}
            value={settings.developerMode}
            onValueChange={(value) => void saveSettings(value ? { developerMode: true } : { developerMode: false, showTechnicalLogs: false })}
          />
          {settings.developerMode ? (
            <>
              <UiSettingRow title={t('settings.showTechnicalLogs')} value={settings.showTechnicalLogs} onValueChange={(value) => void saveSettings({ showTechnicalLogs: value })} />
              <UiSettingRow title={t('settings.keepCache')} value={settings.keepCacheAfterFailedRun} onValueChange={(value) => void saveSettings({ keepCacheAfterFailedRun: value })} />
              <Detail icon="information-outline" label={t('settings.developerMode')} value={t('settings.developerModeBody')} />
            </>
          ) : null}
        </Section>
        : null}

        {category === 'storage' ?
        <Section title={t('settings.categories.storage.title')} icon="history">
          <View style={styles.buttonRow}>
            <SecondaryButton onPress={() => setClearCacheOpen(true)}>
              {t('settings.clearAppCache')}
            </SecondaryButton>
            <SecondaryButton danger onPress={() => setClearHistoryOpen(true)}>
              {t('settings.clearHistory')}
            </SecondaryButton>
          </View>
        </Section>
        : null}
      </ScrollView>

      <OutputOrganizationSheet
        visible={organizationSheetOpen}
        settings={settings}
        onDismiss={() => setOrganizationSheetOpen(false)}
        onModeChange={(mode) =>
          void saveSettings({
            outputOrganization: { mode }
          })
        }
      />

      <ConfirmDialog
        visible={clearCacheOpen}
        title={t('settings.clearCacheTitle')}
        body={t('settings.clearCacheBody')}
        confirmLabel={t('settings.clearAppCache')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={() => void clearCache()}
        onDismiss={() => setClearCacheOpen(false)}
      />
      <ConfirmDialog
        visible={clearHistoryOpen}
        title={t('settings.clearHistoryTitle')}
        body={t('settings.clearHistoryBody')}
        confirmLabel={t('settings.clearHistory')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={() => void confirmClearHistory()}
        onDismiss={() => setClearHistoryOpen(false)}
      />
      <Snackbar visible={Boolean(snackbar)} onDismiss={() => setSnackbar(undefined)} duration={3200}>
        {snackbar}
      </Snackbar>
    </WizardScreen>
  );
}

function OutputOrganizationSheet({
  visible,
  settings,
  onDismiss,
  onModeChange
}: {
  visible: boolean;
  settings: AppSettings;
  onDismiss: () => void;
  onModeChange: (mode: OutputOrganizationMode) => void;
}) {
  const { t } = useTranslation();
  const theme = useAppTheme();

  return (
    <BottomSheet
      visible={visible}
      title={t('settings.outputOrg')}
      subtitle={t('settings.outputOrgSubtitle')}
      onDismiss={onDismiss}
      footer={<PrimaryButton onPress={onDismiss}>{t('common.ok')}</PrimaryButton>}
    >
      {organizationModes.map((mode) => (
        <PressCard
          key={mode}
          title={t(`settings.organizationModes.${mode}.title`)}
          body={t(`settings.organizationModes.${mode}.body`)}
          example={t(`settings.organizationModes.${mode}.example`)}
          selected={settings.outputOrganization.mode === mode}
          onPress={() => onModeChange(mode)}
        />
      ))}
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
        {t('settings.outputOrgFooter')}
      </Text>
    </BottomSheet>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; children: React.ReactNode }) {
  return <SettingsSectionCard title={title} icon={icon}>{children}</SettingsSectionCard>;
}

function DestinationCard({
  title,
  description,
  selected,
  onPress,
  badge
}: {
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
  badge?: string;
}) {
  return (
    <OptionChoiceCard
      title={title}
      description={description}
      selected={selected}
      badge={badge}
      showRadio={false}
      onPress={onPress}
      technicalDetail={description.includes('/') || description.includes('\\') ? description : undefined}
    />
  );
}

function PressCard({
  title,
  body,
  example,
  selected,
  onPress
}: {
  title: string;
  body: string;
  example: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <OptionChoiceCard title={title} description={body} technicalDetail={example} selected={selected} onPress={onPress} />
  );
}

function Detail({ icon, label, value, path = false }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; label: string; value: string; path?: boolean }) {
  return <InfoRow icon={icon} label={label} value={value} path={path} />;
}

function getOrganizationSummaryText(
  t: (key: string) => string,
  organization: AppSettings['outputOrganization']
): string {
  const parts = [t(`settings.organizationModes.${organization.mode}.title`)];
  parts.push(organization.createExportTimestampFolder ? t('settings.createExportTimestampFolder') : t('settings.noExportTimestampFolder'));
  parts.push(t(`settings.duplicateModes.${organization.duplicateHandling}`));
  return parts.join(' • ');
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.card,
    paddingBottom: spacing.section
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.smallGap
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.smallGap
  },
  choiceList: {
    gap: spacing.smallGap
  },
  compactButtonRow: {
    flexDirection: 'row',
    gap: spacing.smallGap
  },
  compactAction: {
    alignSelf: 'flex-start'
  },
  compactButton: {
    flex: 1
  },
  flex: {
    flex: 1
  }
});
