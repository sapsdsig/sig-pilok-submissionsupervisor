import type { ProvinceAreaMasterRow } from '../types/masterData'

// Duplikat sengaja dipertahankan untuk menguji safeguard deduplikasi service.
export const mockProvinceAreaRows: readonly ProvinceAreaMasterRow[] = [
  {
    provinsiId: '11',
    provinsiName: 'ACEH',
    areaId: '502',
    areaName: 'Area 02',
    areaAp: 'SP',
  },
  {
    provinsiId: '11',
    provinsiName: 'ACEH',
    areaId: '502',
    areaName: 'Area 02',
    areaAp: 'SP',
  },
  {
    provinsiId: '11',
    provinsiName: 'ACEH',
    areaId: '501',
    areaName: 'Area 01',
    areaAp: 'SP',
  },
  {
    provinsiId: '12',
    provinsiName: 'SUMATERA UTARA',
    areaId: '510',
    areaName: 'Area 10',
    areaAp: 'SP',
  },
  {
    provinsiId: '12',
    provinsiName: 'SUMATERA UTARA',
    areaId: '510',
    areaName: 'Area 10',
    areaAp: 'SP',
  },
  {
    provinsiId: '94',
    provinsiName: 'PAPUA',
    areaId: '597',
    areaName: 'Area 97',
    areaAp: 'ST',
  },
  {
    provinsiId: '94',
    provinsiName: 'PAPUA',
    areaId: '597',
    areaName: 'Area 97',
    areaAp: 'ST',
  },
  {
    provinsiId: '94',
    provinsiName: 'PAPUA',
    areaId: '598',
    areaName: 'Area 98',
    areaAp: 'ST',
  },
]
