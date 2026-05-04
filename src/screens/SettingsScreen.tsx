import React from 'react';
import { AppState, BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import * as Application from 'expo-application';
import { Directory, Paths } from 'expo-file-system';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Chip, Divider, RadioButton, Snackbar, Surface, Switch, Text } from 'react-native-paper';
import { BottomSheet } from '../components/BottomSheet';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { hasAllFilesAccess, openAllFilesAccessSettings } from '../native/allFilesAccess';
import { openAppLanguageSettings } from '../native/appLanguage';
import { openOutputFolderPicker, testPickedFolderTimestampSupport } from '../native/outputFolderPicker';
import { usePipelineStore } from '../store/pipelineStore';
import { useHistoryStore } from '../store/historyStore';
import { useOnboardingStore } from '../store/onboardingStore';
import { useSettingsStore } from '../store/settingsStore';
import { syncI18nLanguage } from '../i18n';
import { useAppTheme } from '../theme/useAppTheme';
import { FooterActions, WizardScreen } from './WizardScreen';
import { useTranslation } from 'react-i18next';
import type { AppLanguagePreference, AppSettings, DuplicateHandlingMode, OutputOrganizationMode } from '../types/media';

const organizationModes: OutputOrganizationMode[] = ['all-in-one', 'by-type', 'by-sender', 'by-sender-and-type'];
const duplicateModes: DuplicateHandlingMode[] = ['keep-both', 'skip-existing', 'replace-existing'];
const languageOptions: AppLanguagePreference[] = ['system', 'en', 'he'];

export function SettingsScreen() {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const settings = useSettingsStore((state) => state.settings);
  const updateSettings = useSettingsStore((state) => state.updateSettings);
  const resetSaveLocation = useSettingsStore((state) => state.resetSaveLocation);
  const closeOverlayStage = usePipelineStore((state) => state.closeOverlayStage);
  const openOverlayStage = usePipelineStore((state) => state.openOverlayStage);
  const requestOnboardingReplay = useOnboardingStore((state) => state.requestReplay);
  const clearHistory = useHistoryStore((state) => state.clearHistory);
  const [allFilesAccessGranted, setAllFilesAccessGranted] = React.useState(false);
  const [snackbar, setSnackbar] = React.useState<string | undefined>();
  const [clearCacheOpen, setClearCacheOpen] = React.useState(false);
  const [clearHistoryOpen, setClearHistoryOpen] = React.useState(false);
  const [languageBusy, setLanguageBusy] = React.useState(false);
  const [organizationSheetOpen, setOrganizationSheetOpen] = React.useState(false);

  const refreshPermissions = React.useCallback(async () => {
    try {
      setAllFilesAccessGranted(await hasAllFilesAccess());
    } catch {
      setAllFilesAccessGranted(false);
    }
  }, []);

  React.useEffect(() => {
    void refreshPermissions();
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshPermissions();
    });
    const backSubscription = BackHandler.addEventListener('hardwareBackPress', () => {
      closeOverlayStage('welcome');
      return true;
    });
    return () => {
      appStateSubscription.remove();
      backSubscription.remove();
    };
  }, [closeOverlayStage, refreshPermissions]);

  async function chooseFolder() {
    try {
      const folder = await openOutputFolderPicker();
      const support = await testPickedFolderTimestampSupport(folder.treeUri);
      await updateSettings({
        saveDestinationMode: 'custom-folder',
        useDefaultFolder: false,
        customFolder: folder,
        customFolderTimestampSupport: support
      });
    } catch (error) {
      setSnackbar(error instanceof Error ? error.message : t('settings.folderPickFailed'));
    }
  }

  async function applyLanguagePreference(languagePreference: AppLanguagePreference) {
    setLanguageBusy(true);
    try {
      await updateSettings({ languagePreference });
      await syncI18nLanguage(languagePreference);
    } finally {
      setLanguageBusy(false);
    }
  }

  async function clearCache() {
    try {
      const cache = new Directory(Paths.cache);
      if (cache.exists) cache.delete();
      setSnackbar(t('settings.cacheClearedBody'));
    } catch (error) {
      setSnackbar(error instanceof Error ? error.message : t('settings.couldNotClearCache'));
    } finally {
      setClearCacheOpen(false);
    }
  }

  async function confirmClearHistory() {
    await clearHistory();
    setClearHistoryOpen(false);
    setSnackbar(t('settings.historyCleared'));
  }

  return (
    <WizardScreen
      stage="settings"
      title={t('settings.title')}
      subtitle={t('settings.subtitle')}
      onBack={() => closeOverlayStage('welcome')}
      footer={
        <FooterActions>
          <Button mode="contained-tonal" icon="history" onPress={() => openOverlayStage('history')}>
            {t('settings.history')}
          </Button>
        </FooterActions>
      }
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Section title={t('settings.saveLocation')} icon="folder-cog-outline">
          <DestinationCard
            title={t('settings.defaultAccurateFolder')}
            description={t('settings.defaultAccurateFolderBody')}
            selected={settings.saveDestinationMode === 'default-accurate-folder'}
            badge={t('settings.recommended')}
            onPress={() =>
              void updateSettings({
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
            onPress={() =>
              void updateSettings({
                saveDestinationMode: 'custom-folder',
                useDefaultFolder: false
              })
            }
          />
          <View style={styles.buttonRow}>
            <Button mode="outlined" icon="folder-plus-outline" onPress={() => void chooseFolder()}>
              {t('settings.chooseFolder')}
            </Button>
            <Button mode="text" onPress={() => void resetSaveLocation()}>
              {t('settings.resetToDefault')}
            </Button>
          </View>
          <Detail
            icon={allFilesAccessGranted ? 'shield-check-outline' : 'shield-alert-outline'}
            label={t('settings.allFilesAccess')}
            value={allFilesAccessGranted ? t('settings.granted') : t('settings.notGranted')}
          />
          <Button mode="contained-tonal" icon="cog-outline" onPress={() => void openAllFilesAccessSettings()}>
            {t('settings.openAllFilesAccess')}
          </Button>
          {settings.customFolder ? (
            <Detail
              icon={settings.customFolderTimestampSupport?.timestampVerified ? 'calendar-check-outline' : 'calendar-alert-outline'}
              label={t('settings.customFolderDateAccuracy')}
              value={
                settings.customFolderTimestampSupport?.timestampVerified
                  ? t('settings.customFolderDateAccuracyReady')
                  : t('settings.customFolderDateAccuracyLimited')
              }
            />
          ) : null}
        </Section>

        <Section title={t('settings.outputOrg')} icon="folder-multiple-outline">
          <View style={styles.summaryRow}>
            <Text variant="titleSmall">{t(`settings.organizationModes.${settings.outputOrganization.mode}.title`)}</Text>
            <Chip compact onPress={() => setOrganizationSheetOpen(true)}>
              {t('settings.change')}
            </Chip>
          </View>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {getOrganizationSummaryText(t, settings.outputOrganization)}
          </Text>
          <SettingRow
            label={t('settings.createExportTimestampFolder')}
            value={settings.outputOrganization.createExportTimestampFolder}
            onValueChange={(value) =>
              void updateSettings({
                outputOrganization: { ...settings.outputOrganization, createExportTimestampFolder: value }
              })
            }
          />
          <Text variant="labelLarge">{t('settings.duplicateHandling')}</Text>
          <RadioButton.Group
            value={settings.outputOrganization.duplicateHandling}
            onValueChange={(value) =>
              void updateSettings({
                outputOrganization: {
                  ...settings.outputOrganization,
                  duplicateHandling: normalizeDuplicateMode(value)
                }
              })
            }
          >
            {duplicateModes.map((mode) => (
              <RadioItem key={mode} label={t(`settings.duplicateModes.${mode}`)} value={mode} />
            ))}
          </RadioButton.Group>
        </Section>

        <Section title={t('settings.language')} icon="translate">
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            {t('settings.languageInfo')}
          </Text>
          <RadioButton.Group value={settings.languagePreference} onValueChange={(value) => void applyLanguagePreference(normalizeLanguage(value))}>
            {languageOptions.map((languagePreference) => (
              <RadioItem key={languagePreference} label={t(`settings.languageOptions.${languagePreference}`)} value={languagePreference} disabled={languageBusy} />
            ))}
          </RadioButton.Group>
          <Button
            mode="text"
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
          </Button>
        </Section>

        <Section title={t('settings.appearance')} icon="theme-light-dark">
          <RadioButton.Group
            value={settings.appearance}
            onValueChange={(value) => void updateSettings({ appearance: value === 'dark' ? 'dark' : value === 'light' ? 'light' : 'system' })}
          >
            <RadioItem label={t('settings.systemDefault')} value="system" />
            <RadioItem label={t('settings.light')} value="light" />
            <RadioItem label={t('settings.dark')} value="dark" />
          </RadioButton.Group>
          <SettingRow
            label={t('settings.dynamicColors')}
            value={settings.useDynamicColors}
            onValueChange={(value) => void updateSettings({ useDynamicColors: value })}
          />
        </Section>

        <Section title={t('settings.appOptions')} icon="tune-variant">
          <Detail icon="star-four-points-outline" label={t('settings.welcomeTour')} value={t('settings.welcomeTourBody')} />
          <Button
            mode="contained-tonal"
            icon="play-circle-outline"
            onPress={() => {
              closeOverlayStage('welcome');
              requestOnboardingReplay();
            }}
          >
            {t('settings.showWelcomeTourAgain')}
          </Button>
          <SettingRow
            label={t('settings.developerModeToggle')}
            value={settings.developerMode}
            onValueChange={(value) => void updateSettings({ developerMode: value, showTechnicalLogs: value ? settings.showTechnicalLogs : false })}
          />
          {settings.developerMode ? (
            <>
              <SettingRow label={t('settings.showTechnicalLogs')} value={settings.showTechnicalLogs} onValueChange={(value) => void updateSettings({ showTechnicalLogs: value })} />
              <SettingRow label={t('settings.keepCache')} value={settings.keepCacheAfterFailedRun} onValueChange={(value) => void updateSettings({ keepCacheAfterFailedRun: value })} />
              <Detail icon="information-outline" label={t('settings.developerMode')} value={t('settings.developerModeBody')} />
            </>
          ) : null}
          <Detail icon="folder-outline" label={t('settings.lastOutputFolder')} value={settings.lastOutputFolder ?? t('settings.noneYet')} />
          <Detail
            icon="information-outline"
            label={t('settings.versionBuild')}
            value={`${Application.nativeApplicationVersion ?? '0.1.0'} (${Application.nativeBuildVersion ?? t('settings.devBuild')})`}
          />
          <View style={styles.buttonRow}>
            <Button mode="outlined" onPress={() => setClearCacheOpen(true)}>
              {t('settings.clearAppCache')}
            </Button>
            <Button mode="text" onPress={() => setClearHistoryOpen(true)}>
              {t('settings.clearHistory')}
            </Button>
          </View>
        </Section>
      </ScrollView>

      <OutputOrganizationSheet
        visible={organizationSheetOpen}
        settings={settings}
        onDismiss={() => setOrganizationSheetOpen(false)}
        onModeChange={(mode) =>
          void updateSettings({
            outputOrganization: { ...settings.outputOrganization, mode }
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
    <BottomSheet visible={visible} title={t('settings.outputOrg')} subtitle={t('settings.outputOrgSubtitle')} onDismiss={onDismiss}>
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
  const theme = useAppTheme();
  return (
    <Surface elevation={0} style={[styles.section, { borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surface }]}>
      <View style={styles.sectionTitle}>
        <MaterialCommunityIcons name={icon} size={20} color={theme.colors.primary} />
        <Text variant="titleMedium">{title}</Text>
      </View>
      <Divider />
      {children}
    </Surface>
  );
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
  const { t } = useTranslation();
  const theme = useAppTheme();
  return (
    <Surface
      elevation={0}
      style={[
        styles.choiceCard,
        {
          backgroundColor: selected ? theme.colors.primaryContainer : theme.colors.surfaceContainerHigh ?? theme.colors.surfaceVariant,
          borderColor: selected ? theme.colors.primary : theme.colors.outlineVariant
        }
      ]}
    >
      <View style={styles.summaryRow}>
        <Text variant="titleSmall" style={styles.flex}>
          {title}
        </Text>
        {badge ? <Chip compact>{badge}</Chip> : null}
      </View>
      <Text variant="bodySmall" style={{ color: selected ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant }}>
        {description}
      </Text>
      <Button mode={selected ? 'contained-tonal' : 'outlined'} compact onPress={onPress}>
        {selected ? t('common.selected') : t('common.useThis')}
      </Button>
    </Surface>
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
  const theme = useAppTheme();
  return (
    <Surface
      elevation={0}
      style={[
        styles.choiceCard,
        {
          backgroundColor: selected ? theme.colors.secondaryContainer : theme.colors.surfaceContainerHigh ?? theme.colors.surfaceVariant,
          borderColor: selected ? theme.colors.secondary : theme.colors.outlineVariant
        }
      ]}
    >
      <View style={styles.summaryRow}>
        <Text variant="titleSmall" style={styles.flex}>
          {title}
        </Text>
        <RadioButton value={title} status={selected ? 'checked' : 'unchecked'} onPress={onPress} />
      </View>
      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
        {body}
      </Text>
      <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
        {example}
      </Text>
    </Surface>
  );
}

function SettingRow({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (value: boolean) => void }) {
  return (
    <View style={styles.row}>
      <Text variant="bodyMedium" style={styles.flex}>
        {label}
      </Text>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

function RadioItem({ label, value, disabled = false }: { label: string; value: string; disabled?: boolean }) {
  return (
    <View style={styles.row}>
      <RadioButton value={value} disabled={disabled} />
      <Text variant="bodyMedium" style={styles.flex}>
        {label}
      </Text>
    </View>
  );
}

function Detail({ icon, label, value }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; label: string; value: string }) {
  const theme = useAppTheme();
  return (
    <View style={styles.detail}>
      <MaterialCommunityIcons name={icon} size={18} color={theme.colors.secondary} />
      <View style={styles.flex}>
        <Text variant="labelMedium">{label}</Text>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function normalizeDuplicateMode(value: string): DuplicateHandlingMode {
  if (value === 'skip-existing' || value === 'replace-existing') return value;
  return 'keep-both';
}

function normalizeLanguage(value: string): AppLanguagePreference {
  if (value === 'en' || value === 'he') return value;
  return 'system';
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
    gap: 14,
    paddingBottom: 24
  },
  section: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 24,
    padding: 16,
    gap: 12
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  choiceCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    padding: 14,
    gap: 10
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  row: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  detail: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  flex: {
    flex: 1
  }
});
