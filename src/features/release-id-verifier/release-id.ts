const releaseTypes = {
  100: 'Official',
  '000': 'Promo',
} as const;

const releaseSubtypes = {
  8: 'Compilation',
  2: 'Release',
  3: 'Split',
} as const;

const invalidReleaseIdMessage = 'Invalid Strange Animals release ID.';

type ReleaseDisplay = {
  Type: string;
  Subtype: string;
  'Release number': string;
  'Release year': number;
};

type ReleaseValidationResult =
  | {
      valid: true;
      message: string;
      display: ReleaseDisplay;
    }
  | {
      valid: false;
      message: string;
    };

function normalizeReleaseId(inputValue: string) {
  return inputValue.replace(/[\s-]+/g, '').toUpperCase();
}

function getReleaseYear(yearCode: string) {
  return 2026 + (yearCode.charCodeAt(0) - 'A'.charCodeAt(0));
}

// Temporary frontend implementation. This checksum logic should eventually be moved to a backend verification service.
export function calculateChecksum(idWithoutChecksum: string) {
  const numericDigits = idWithoutChecksum.replace(/[A-Z]/g, '').split('');
  const sum = numericDigits.reduce((total, digit) => total + Number(digit), 0);
  const wrapped = ((sum - 1) % 99) + 1;

  return String(wrapped).padStart(2, '0');
}

// Temporary frontend implementation. This checksum logic should eventually be moved to a backend verification service.
export function validateReleaseId(inputValue: string): ReleaseValidationResult {
  const releaseId = normalizeReleaseId(inputValue);

  if (releaseId.length < 13) {
    return {
      valid: false,
      message: invalidReleaseIdMessage,
    };
  }

  const typeCode = releaseId.slice(0, 3);
  const subtypeCode = releaseId.slice(3, 4);
  const checksum = releaseId.slice(-2);
  const yearCode = releaseId.slice(-3, -2);
  const releaseNumber = releaseId.slice(-6, -3);
  const releaseCode = releaseId.slice(4, -6);

  if (
    !(typeCode in releaseTypes) ||
    !(subtypeCode in releaseSubtypes) ||
    !/^\d{3,}$/.test(releaseCode) ||
    !/^\d{3}$/.test(releaseNumber) ||
    !/^[A-Z]$/.test(yearCode) ||
    !/^\d{2}$/.test(checksum)
  ) {
    return {
      valid: false,
      message: invalidReleaseIdMessage,
    };
  }

  const expectedChecksum = calculateChecksum(releaseId.slice(0, -2));

  if (checksum !== expectedChecksum) {
    return {
      valid: false,
      message: invalidReleaseIdMessage,
    };
  }

  return {
    valid: true,
    message: 'Status: Valid Strange Animals Release ID',
    display: {
      Type: releaseTypes[typeCode as keyof typeof releaseTypes],
      Subtype: releaseSubtypes[subtypeCode as keyof typeof releaseSubtypes],
      'Release number': releaseNumber,
      'Release year': getReleaseYear(yearCode),
    },
  };
}
