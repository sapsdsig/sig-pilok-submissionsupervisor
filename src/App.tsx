import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormProvider, useFieldArray, useForm } from 'react-hook-form'
import { ConfirmationDialog } from './components/ConfirmationDialog'
import { DistributorSection } from './components/DistributorSection'
import { FieldError } from './components/FieldError'
import { CheckIcon } from './components/icons'
import { WilayahCard } from './components/WilayahCard'
import { createSupervisorFormSchema } from './schemas/supervisorFormSchema'
import { ApiClientError } from './services/apiClient'
import { distributorService } from './services/distributorService'
import { regionService } from './services/regionService'
import { submissionService } from './services/submissionService'
import { uploadService } from './services/uploadService'
import type { SubmissionRequest, SubmissionResult } from './types/api'
import {
  createDefaultFormValues,
  createEmptyWilayah,
  type SupervisorFormValues,
  type WilayahEntry,
} from './types/form'
import type { ProvinceOption } from './types/masterData'
import { normalizeSubmission } from './utils/submission'
import { createRequestToken } from './utils/requestToken'

type ProcessingStatus =
  | {
      stage: 'upload'
      wilayahNo: number
      supervisorNo: number
      fileName: string
      progress: number
    }
  | { stage: 'persistence' }

const isWilayahPopulated = (wilayah: WilayahEntry): boolean =>
  Boolean(wilayah.provinsiId || wilayah.areaId) ||
  wilayah.supervisors.some(
    (supervisor) =>
      supervisor.namaSupervisor.trim().length > 0 || supervisor.ktp !== null,
  )

function App() {
  const schema = useMemo(
    () =>
      createSupervisorFormSchema({
        isKnownDistributor: (distributor) =>
          distributorService.isKnownDistributor(distributor),
        getProvince: (provinceId) => regionService.getProvince(provinceId),
        getArea: (provinceId, areaId) =>
          regionService.getArea(provinceId, areaId),
      }),
    [],
  )
  const methods = useForm<SupervisorFormValues>({
    resolver: zodResolver(schema),
    defaultValues: createDefaultFormValues(),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    shouldFocusError: true,
  })
  const {
    control,
    getValues,
    handleSubmit,
    reset,
    setError,
    setValue,
    clearErrors,
    watch,
    formState: { errors, isSubmitting },
  } = methods
  const { fields, append, remove } = useFieldArray({ control, name: 'wilayah' })
  const [provinces, setProvinces] = useState<ProvinceOption[]>([])
  const [isLoadingProvinces, setIsLoadingProvinces] = useState(true)
  const [provinceLoadError, setProvinceLoadError] = useState<string>()
  const [isSearching, setIsSearching] = useState(false)
  const [submissionError, setSubmissionError] = useState<string>()
  const [successResult, setSuccessResult] = useState<SubmissionResult>()
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>()
  const [pendingWilayahRemoval, setPendingWilayahRemoval] = useState<number | null>(null)
  const processingRef = useRef(false)
  const resolvedDistributor = watch('distributorTerverifikasi')
  const code = watch('kodeDistributor')
  const isResolved =
    resolvedDistributor !== null && resolvedDistributor.kodeDistributor === code

  const loadProvinces = useCallback(async () => {
    setIsLoadingProvinces(true)
    setProvinceLoadError(undefined)
    try {
      setProvinces(await regionService.getProvinces())
    } catch (error) {
      setProvinces([])
      setProvinceLoadError(
        error instanceof ApiClientError
          ? error.message
          : 'Master Provinsi gagal dimuat. Silakan coba kembali.',
      )
    } finally {
      setIsLoadingProvinces(false)
    }
  }, [])

  useEffect(() => {
    void loadProvinces()
  }, [loadProvinces])

  const handleCodeChanged = () => {
    if (getValues('distributorTerverifikasi') !== null) {
      setValue('namaDistributor', '', { shouldDirty: true })
      setValue('distributorTerverifikasi', null, { shouldDirty: true })
    }
    clearErrors('kodeDistributor')
    setSubmissionError(undefined)
  }

  const handleDistributorLookup = async () => {
    const lookupCode = getValues('kodeDistributor')
    setSubmissionError(undefined)

    if (!lookupCode) {
      setError('kodeDistributor', {
        type: 'manual',
        message: 'Kode Distributor wajib diisi.',
      })
      return
    }

    setIsSearching(true)
    try {
      const distributor = await distributorService.findByCode(lookupCode)
      if (getValues('kodeDistributor') !== lookupCode) return

      if (!distributor) {
        setValue('namaDistributor', '', { shouldDirty: true })
        setValue('distributorTerverifikasi', null, { shouldDirty: true })
        setError('kodeDistributor', {
          type: 'manual',
          message:
            'Kode Distributor tidak ditemukan. Periksa kembali kode yang dimasukkan.',
        })
        return
      }

      setValue('namaDistributor', distributor.namaDistributor, {
        shouldDirty: true,
        shouldValidate: true,
      })
      setValue('distributorTerverifikasi', distributor, {
        shouldDirty: true,
        shouldValidate: true,
      })
      clearErrors('kodeDistributor')
    } catch (error) {
      if (getValues('kodeDistributor') !== lookupCode) return
      setError('kodeDistributor', {
        type: 'manual',
        message:
          error instanceof ApiClientError
            ? error.message
            : 'Pencarian distributor gagal. Silakan coba kembali.',
      })
    } finally {
      setIsSearching(false)
    }
  }

  const requestWilayahRemoval = (index: number) => {
    if (fields.length <= 1) return
    const wilayah = getValues(`wilayah.${index}`)
    if (isWilayahPopulated(wilayah)) {
      setPendingWilayahRemoval(index)
    } else {
      remove(index)
    }
  }

  const onSubmit = async (values: SupervisorFormValues) => {
    if (processingRef.current) return
    processingRef.current = true
    setSubmissionError(undefined)

    const requestToken = createRequestToken()
    const uploadedFileIds: string[] = []
    try {
      const normalized = normalizeSubmission(values)
      const wilayah: SubmissionRequest['wilayah'] = []

      for (const [areaIndex, area] of normalized.wilayah.entries()) {
        const supervisors: SubmissionRequest['wilayah'][number]['supervisors'] = []
        for (const supervisor of area.supervisors) {
          setProcessingStatus({
            stage: 'upload',
            wilayahNo: areaIndex + 1,
            supervisorNo: supervisor.supervisorNo,
            fileName: supervisor.ktp.name,
            progress: 0,
          })
          const ktp = await uploadService.uploadKtp(
            {
              requestToken,
              kodeDistributor: normalized.kodeDistributor,
              provinsiId: area.provinsiId,
              areaId: area.areaId,
              supervisorNo: supervisor.supervisorNo,
              namaSupervisor: supervisor.namaSupervisor,
              file: supervisor.ktp,
            },
            (progress) =>
              setProcessingStatus((current) =>
                current?.stage === 'upload'
                  ? { ...current, progress }
                  : current,
              ),
            (fileId) => uploadedFileIds.push(fileId),
          )
          supervisors.push({
            namaSupervisor: supervisor.namaSupervisor,
            ktp,
          })
        }
        wilayah.push({
          provinsiId: area.provinsiId,
          areaId: area.areaId,
          supervisors,
        })
      }

      setProcessingStatus({ stage: 'persistence' })
      const result = await submissionService.submit({
        requestToken,
        kodeDistributor: normalized.kodeDistributor,
        wilayah,
      })
      setSuccessResult(result)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      try {
        await uploadService.cleanup(requestToken, uploadedFileIds)
      } catch (cleanupError) {
        if (import.meta.env.DEV) {
          console.error('Best-effort cleanup request failed', {
            errorName:
              cleanupError instanceof Error ? cleanupError.name : 'UnknownError',
          })
        }
      }
      setSubmissionError(
        error instanceof ApiClientError
          ? error.message
          : 'Submission gagal diproses. Data belum tersimpan; silakan coba kembali.',
      )
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
    } finally {
      processingRef.current = false
      setProcessingStatus(undefined)
    }
  }

  const startNewForm = () => {
    reset(createDefaultFormValues())
    setSuccessResult(undefined)
    setSubmissionError(undefined)
    setProcessingStatus(undefined)
    setPendingWilayahRemoval(null)
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-sky-900/20 bg-gradient-to-r from-[#0d416d] to-[#12689b] text-white shadow-sm">
        <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
          <div className="flex items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/15 text-lg font-black tracking-tight ring-1 ring-white/25">
              P
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-200">PILOK</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Form Data Supervisor</h1>
            </div>
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-sky-100 sm:text-base">
            Lengkapi data wilayah operasional dan Supervisor untuk distributor yang terdaftar.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {successResult ? (
          <section className="mx-auto max-w-2xl rounded-2xl border border-emerald-200 bg-white p-7 text-center shadow-sm sm:p-10" role="status">
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-600 text-white">
              <CheckIcon className="size-7" />
            </span>
            <h2 className="mt-5 text-2xl font-bold text-slate-900">Data Supervisor berhasil disimpan.</h2>
            <p className="mt-2 text-sm text-slate-600">Simpan Submission ID berikut sebagai referensi.</p>
            <p className="mx-auto mt-5 max-w-md rounded-xl bg-slate-100 px-4 py-3 font-mono text-sm font-bold text-slate-800">
              {successResult.submissionId}
            </p>
            <button type="button" className="button-primary mt-7" onClick={startNewForm}>
              Isi Form Baru
            </button>
          </section>
        ) : (
          <FormProvider {...methods}>
            <form className="space-y-6" noValidate onSubmit={handleSubmit(onSubmit)}>
              <DistributorSection
                isSearching={isSearching}
                isResolved={isResolved}
                onLookup={handleDistributorLookup}
                onCodeChanged={handleCodeChanged}
              />

              {isResolved && (
                <section className="form-section" aria-labelledby="wilayah-heading">
                  <div className="section-heading">
                    <span className="step-badge">2</span>
                    <div>
                      <h2 id="wilayah-heading">Wilayah Operasional</h2>
                      <p>Setiap kartu mewakili satu kombinasi Provinsi dan Area.</p>
                    </div>
                  </div>

                  {provinceLoadError && (
                    <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
                      <p>{provinceLoadError}</p>
                      <button type="button" className="mt-2 font-bold underline" onClick={() => void loadProvinces()}>
                        Coba muat kembali
                      </button>
                    </div>
                  )}
                  {isLoadingProvinces && (
                    <p className="mt-5 text-sm text-slate-500" role="status">Memuat master Provinsi...</p>
                  )}

                  <div className="mt-6 space-y-5">
                    {fields.map((field, index) => (
                      <WilayahCard
                        key={`${field.id}-${index}`}
                        index={index}
                        provinces={provinces}
                        regionService={regionService}
                        canRemove={fields.length > 1}
                        onRemove={() => requestWilayahRemoval(index)}
                      />
                    ))}
                  </div>

                  <FieldError
                    message={typeof errors.wilayah?.message === 'string' ? errors.wilayah.message : undefined}
                  />

                  <button
                    type="button"
                    className="button-secondary mt-5 w-full border-dashed sm:w-auto"
                    onClick={() => {
                      append(createEmptyWilayah())
                      setSubmissionError(undefined)
                    }}
                  >
                    <span className="text-xl leading-none" aria-hidden="true">+</span>
                    Tambah Wilayah
                  </button>
                </section>
              )}

              {isResolved && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  {submissionError && (
                    <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700" role="alert">
                      {submissionError}
                    </div>
                  )}
                  {processingStatus && (
                    <div className="mb-5 rounded-xl border border-sky-200 bg-sky-50 p-4" role="status">
                      {processingStatus.stage === 'upload' ? (
                        <>
                          <p className="text-sm font-semibold text-sky-900">
                            Mengunggah KTP Supervisor {processingStatus.supervisorNo} · Wilayah {processingStatus.wilayahNo}
                          </p>
                          <p className="mt-1 truncate text-xs text-sky-700">{processingStatus.fileName}</p>
                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-sky-200">
                            <div className="h-full rounded-full bg-sky-700 transition-[width]" style={{ width: `${processingStatus.progress}%` }} />
                          </div>
                          <p className="mt-1 text-right text-xs font-bold text-sky-800">{processingStatus.progress}%</p>
                        </>
                      ) : (
                        <p className="text-sm font-semibold text-sky-900">Menyimpan submission ke Google Sheets...</p>
                      )}
                    </div>
                  )}
                  <div className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center">
                    <p className="text-sm leading-6 text-slate-600">
                      KTP diunggah langsung ke Google Drive, lalu data disimpan setelah seluruh upload berhasil.
                    </p>
                    <button type="submit" className="button-primary min-w-40" disabled={isSubmitting || Boolean(processingStatus)}>
                      {isSubmitting ? 'Memproses...' : 'Submit Data'}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </FormProvider>
        )}
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-8 text-center text-xs text-slate-500 sm:px-6 lg:px-8">
        PILOK Supervisor Form · Phase 2
      </footer>

      <ConfirmationDialog
        open={pendingWilayahRemoval !== null}
        title="Hapus Wilayah?"
        description={`Wilayah ${pendingWilayahRemoval === null ? '' : pendingWilayahRemoval + 1} berisi data. Seluruh pilihan wilayah, nama Supervisor, dan file KTP di dalamnya akan dihapus.`}
        onCancel={() => setPendingWilayahRemoval(null)}
        onConfirm={() => {
          if (pendingWilayahRemoval !== null) remove(pendingWilayahRemoval)
          setPendingWilayahRemoval(null)
        }}
      />
    </div>
  )
}

export default App
