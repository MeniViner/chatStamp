import { StyleSheet } from 'react-native';

export const screenStyles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    gap: 16,
    backgroundColor: '#f8fafc'
  },
  topContainer: {
    flex: 1,
    padding: 16,
    gap: 12,
    backgroundColor: '#f8fafc'
  },
  cardContent: {
    gap: 16
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  selectedChip: {
    borderColor: '#0f766e',
    backgroundColor: '#ccfbf1'
  },
  unselectedChip: {
    borderColor: '#94a3b8',
    backgroundColor: '#ffffff'
  },
  selectedListItem: {
    borderRadius: 8,
    backgroundColor: '#e0f2fe'
  },
  unselectedListItem: {
    borderRadius: 8,
    backgroundColor: '#ffffff'
  },
  previewList: {
    gap: 8
  },
  previewItem: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff'
  }
});
