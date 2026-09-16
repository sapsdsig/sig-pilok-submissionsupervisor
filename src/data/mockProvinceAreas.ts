import type { ProvinceAreaMasterRow } from '../types/masterData'

// Duplikat sengaja dipertahankan untuk menguji safeguard deduplikasi service.
export const mockProvinceAreaRows: readonly ProvinceAreaMasterRow[] = [
  { provinsiName: 'ACEH', areaName: 'Area 02' },
  { provinsiName: 'ACEH', areaName: 'Area 02' },
  { provinsiName: 'ACEH', areaName: 'Area 01' },
  { provinsiName: 'SUMATERA UTARA', areaName: 'Area 10' },
  { provinsiName: 'SUMATERA UTARA', areaName: 'Area 10' },
  { provinsiName: 'PAPUA', areaName: 'Area 97' },
  { provinsiName: 'PAPUA', areaName: 'Area 97' },
  { provinsiName: 'PAPUA', areaName: 'Area 98' },
]
