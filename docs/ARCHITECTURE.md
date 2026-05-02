# Architecture

## Design style

The app is a local stateless pipeline. Each run starts with a ZIP and ends with saved Gallery assets plus cache cleanup.

## Layers

### UI layer

`src/screens/*` and `src/components/*`

Responsibilities:

- Render current pipeline state.
- Collect user selections.
- Trigger service actions.

Must not:

- Parse `_chat.txt` directly.
- Access native modules directly.
- Perform ZIP extraction directly.

### State layer

`src/store/pipelineStore.ts`

Responsibilities:

- Current ZIP info.
- Parsed records.
- Sender selections.
- Media type selections.
- Processing progress.
- Completion summary.

No persistence for MVP.

### Pure library layer

`src/lib/*`

Responsibilities:

- Chat parsing.
- Date parsing.
- Filename normalization.
- Media classification.
- Matching logic.

This layer must be testable without React Native.

### Service layer

`src/services/*`

Responsibilities:

- Orchestrate pipeline.
- Use file system APIs.
- Use ZIP extraction adapters.
- Use media library adapters.
- Report progress.

### Native boundary

`src/native/*`

Responsibilities:

- Declare and wrap native module calls.
- Keep native-specific details out of business logic.

## Data model summary

```ts
type ChatMediaRecord = {
  id: string;
  filename: string;
  sender: string;
  messageDate: string; // ISO
  rawLine: string;
};

type ExtractedMediaFile = {
  id: string;
  filename: string;
  uri: string;
  mediaType: 'photo' | 'video' | 'voice' | 'other';
  matchedRecord?: ChatMediaRecord;
};
```

## Metadata strategy

The app should attempt metadata writes in this order:

1. Preserve or write EXIF `DateTimeOriginal` / equivalent for photos where supported.
2. Save to Gallery via MediaStore-compatible API.
3. Update Android MediaStore fields through a native bridge if needed.
4. Verify actual Gallery sorting manually.

Do not mark the MVP complete until real Gallery sorting is verified.
