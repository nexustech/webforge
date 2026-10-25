import {
  Button,
  Check,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ErrorText,
  Field,
  fieldControlClass,
  ImageChoice,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TextInput,
  TimeInput,
} from "@webforge/editor-ui";
import { t } from "@webforge/i18n";
import {
  BUSINESS_NAME_MAX,
  type ImageMeta,
  isImageMeta,
  MEASUREMENT_ID_MAX,
  type MediaId,
  OPENING_HOURS_NOTE_MAX,
  POSTAL_ADDRESS_MAX,
  SITE_DESCRIPTION_MAX,
  SITE_NAME_MAX,
  type SiteDoc,
  type SiteSettings,
  SOCIAL_NETWORKS,
  X_HANDLE_MAX,
} from "@webforge/model";
import { PlusIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { mediaImageUrl } from "../../shared/ipc/media.js";
import {
  checkSettings,
  DAYS,
  FORM_SERVICES,
  SECTIONS,
  type Section,
  type SettingsForm,
  toSettingsForm,
} from "./settings-form.js";

/** Props of {@link SiteSettingsDialog}. */
export type SiteSettingsDialogProps = {
  readonly open: boolean;
  readonly site: SiteDoc;
  /** Valid settings to save; the dialog has checked them. */
  readonly onSave: (settings: SiteSettings) => void;
  readonly onCancel: () => void;
  /** Where an image's thumbnail is; the `webforge-media:` scheme by default, data URLs in stories. */
  readonly imageUrl?: (item: ImageMeta) => string;
  /** The section shown first; stories show the others. */
  readonly initialSection?: Section;
};

/**
 * Site Settings (F-SET-1, X3): the details that apply to the whole site, in sections. Save checks
 * every value with the model's own schema and points at what needs fixing in plain words; saved
 * settings are one undo step. Publishing destinations are set up when publishing (B1).
 */
export function SiteSettingsDialog(props: SiteSettingsDialogProps) {
  return (
    <Dialog
      open={props.open}
      onOpenChange={(next) => {
        if (!next) props.onCancel();
      }}
    >
      {/* Mounted with each opening, so the form starts from the saved settings every time. */}
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl">
        {props.open ? <SiteSettingsForm {...props} /> : null}
      </DialogContent>
    </Dialog>
  );
}

/** Media thumbnails, by default. */
const thumbnailUrl: NonNullable<SiteSettingsDialogProps["imageUrl"]> = (item) =>
  mediaImageUrl(item, "thumbnail");

function SiteSettingsForm({
  site,
  onSave,
  onCancel,
  imageUrl = thumbnailUrl,
  initialSection = "general",
}: SiteSettingsDialogProps) {
  const [form, setForm] = useState<SettingsForm>(() => toSettingsForm(site.settings));
  const [errors, setErrors] = useState<Readonly<Record<string, string>>>({});
  const [section, setSection] = useState<Section>(initialSection);
  const images = Object.values(site.media).filter(isImageMeta);
  const change = (next: Partial<SettingsForm>) => setForm((current) => ({ ...current, ...next }));
  const invalid = (field: string) => errorProps(field, errors);

  return (
    <form
      className="grid gap-3"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const checked = checkSettings(form, site.settings);
        if (checked.ok) {
          onSave(checked.settings);
          return;
        }
        setErrors(checked.errors);
        // Show the first section with something to fix.
        const first = SECTIONS.find((name) =>
          Object.keys(checked.errors).some((field) => sectionOf(field) === name),
        );
        if (first !== undefined) setSection(first);
      }}
    >
      <DialogHeader>
        <DialogTitle>{t("site.settings.title")}</DialogTitle>
        <DialogDescription>{t("site.settings.description")}</DialogDescription>
      </DialogHeader>

      <Tabs
        value={section}
        onValueChange={(value) => setSection(SECTIONS.find((name) => name === value) ?? section)}
      >
        <TabsList
          aria-label={t("site.settings.sections")}
          // Seven sections wrap onto a second row in a narrow window; each row keeps the tabs' height.
          className="h-auto flex-wrap [&>*]:h-8"
        >
          {SECTIONS.map((name) => (
            <TabsTrigger key={name} value={name}>
              {t(`site.settings.section.${name}`)}
              {Object.keys(errors).some((field) => sectionOf(field) === name) ? (
                <span aria-hidden className="ml-1 size-1.5 rounded-full bg-destructive" />
              ) : null}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="general" className="grid gap-3 pt-3">
          <TextInput
            label={t("site.settings.name")}
            value={form.name}
            maxLength={SITE_NAME_MAX}
            error={errors["general.name"]}
            onChange={(name) => change({ name })}
          />
          <TextInput
            label={t("site.settings.siteDescription")}
            hint={t("site.settings.siteDescriptionHint")}
            multiline
            value={form.description}
            maxLength={SITE_DESCRIPTION_MAX}
            error={errors["general.description"]}
            onChange={(description) => change({ description })}
          />
          <Field
            label={t("site.settings.language")}
            hint={t("site.settings.languageHint")}
            error={errors["general.language"]}
          >
            {(control) => (
              <input
                {...control}
                className={cn(fieldControlClass, "w-32")}
                value={form.language}
                maxLength={35}
                onChange={(event) => change({ language: event.currentTarget.value })}
              />
            )}
          </Field>
          <ImagePicker
            name="site-icon"
            legend={t("site.settings.icon")}
            hint={t("site.settings.iconHint")}
            images={images}
            imageUrl={imageUrl}
            value={form.icon}
            onChange={(icon) => change({ icon })}
          />
          <Check
            label={t("site.settings.backToTop")}
            // The canvas doesn't show it: only the published site has it.
            hint={t("site.settings.backToTopHint")}
            checked={form.backToTop}
            onChange={(backToTop) => change({ backToTop })}
          />
        </TabsContent>

        <TabsContent value="address" className="grid gap-3 pt-3">
          <Field
            label={t("site.settings.webAddress")}
            hint={t("site.settings.webAddressHint")}
            error={errors["address.url"]}
          >
            {(control) => (
              <input
                {...control}
                type="url"
                inputMode="url"
                className={fieldControlClass}
                placeholder={t("site.settings.webAddressPlaceholder")}
                value={form.url}
                onChange={(event) => change({ url: event.currentTarget.value })}
              />
            )}
          </Field>
        </TabsContent>

        <TabsContent value="social" className="grid gap-3 pt-3">
          <fieldset className="grid gap-1.5">
            <legend className="mb-1 text-xs text-muted-foreground">
              {t("site.settings.profiles")}
            </legend>
            {form.profiles.map((profile, index) => {
              const field = `social.profiles.${index}.url`;
              const replace = (next: Partial<(typeof form.profiles)[number]>) =>
                change({
                  profiles: form.profiles.map((other, at) =>
                    at === index ? { ...other, ...next } : other,
                  ),
                });
              return (
                // Rows have no ids of their own; their inputs are controlled, so keys by position
                // are enough.
                <div key={index} className="grid gap-1">
                  <div className="flex gap-1.5">
                    <select
                      aria-label={t("site.settings.network")}
                      className={cn(fieldControlClass, "w-32")}
                      value={profile.network}
                      onChange={(event) => {
                        const { value } = event.currentTarget;
                        const network = SOCIAL_NETWORKS.find((name) => name === value);
                        if (network !== undefined) replace({ network });
                      }}
                    >
                      {SOCIAL_NETWORKS.map((network) => (
                        <option key={network} value={network}>
                          {t(`site.settings.network.${network}`)}
                        </option>
                      ))}
                    </select>
                    <input
                      aria-label={t("site.settings.profileUrl")}
                      type="url"
                      inputMode="url"
                      className={fieldControlClass}
                      placeholder="https://"
                      value={profile.url}
                      onChange={(event) => replace({ url: event.currentTarget.value })}
                      {...invalid(field)}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={t("site.settings.removeProfile")}
                      title={t("site.settings.removeProfile")}
                      onClick={() =>
                        change({ profiles: form.profiles.filter((_, at) => at !== index) })
                      }
                    >
                      <XIcon />
                    </Button>
                  </div>
                  <ErrorText id={errorId(field)} message={errors[field]} />
                </div>
              );
            })}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="justify-self-start"
              onClick={() =>
                change({ profiles: [...form.profiles, { network: "facebook", url: "" }] })
              }
            >
              <PlusIcon />
              {t("site.settings.addProfile")}
            </Button>
            {/* The logos are trademarks (PH2-4): they may only link to the site's own pages. */}
            <p className="m-0 text-xs text-muted-foreground">{t("site.settings.profilesHint")}</p>
          </fieldset>
          <ImagePicker
            name="site-share-image"
            legend={t("site.settings.shareImage")}
            hint={t("site.settings.shareImageHint")}
            images={images}
            imageUrl={imageUrl}
            value={form.shareImage}
            onChange={(shareImage) => change({ shareImage })}
          />
          <Field label={t("site.settings.xHandle")} error={errors["social.xHandle"]}>
            {(control) => (
              <input
                {...control}
                className={cn(fieldControlClass, "w-48")}
                placeholder="@"
                value={form.xHandle}
                maxLength={X_HANDLE_MAX}
                onChange={(event) => change({ xHandle: event.currentTarget.value })}
              />
            )}
          </Field>
        </TabsContent>

        <TabsContent value="contact" className="grid gap-3 pt-3">
          <TextInput
            label={t("site.settings.businessName")}
            error={errors["contact.businessName"]}
            value={form.businessName}
            maxLength={BUSINESS_NAME_MAX}
            onChange={(businessName) => change({ businessName })}
          />
          <TextInput
            label={t("site.settings.email")}
            error={errors["contact.email"]}
            type="email"
            value={form.email}
            onChange={(email) => change({ email })}
          />
          <TextInput
            label={t("site.settings.phone")}
            error={errors["contact.phone"]}
            type="tel"
            value={form.phone}
            onChange={(phone) => change({ phone })}
          />
          <TextInput
            label={t("site.settings.address")}
            multiline
            value={form.address}
            maxLength={POSTAL_ADDRESS_MAX}
            error={errors["contact.address"]}
            onChange={(address) => change({ address })}
          />
          <OpeningHours form={form} errors={errors} invalid={invalid} change={change} />
          <TextInput
            label={t("site.settings.openingHoursNote")}
            hint={t("site.settings.openingHoursNoteHint")}
            error={errors["contact.openingHoursNote"]}
            value={form.openingHoursNote}
            maxLength={OPENING_HOURS_NOTE_MAX}
            onChange={(openingHoursNote) => change({ openingHoursNote })}
          />
        </TabsContent>

        <TabsContent value="search" className="grid gap-2 pt-3">
          <Check
            label={t("site.settings.allowIndexing")}
            checked={form.allowIndexing}
            onChange={(allowIndexing) => change({ allowIndexing })}
          />
          <Check
            label={t("site.settings.includeSitemap")}
            checked={form.includeSitemap}
            onChange={(includeSitemap) => change({ includeSitemap })}
          />
        </TabsContent>

        <TabsContent value="analytics" className="grid gap-3 pt-3">
          <TextInput
            label={t("site.settings.measurementId")}
            hint={t("site.settings.measurementIdHint")}
            error={errors["analytics.measurementId"]}
            value={form.measurementId}
            maxLength={MEASUREMENT_ID_MAX}
            onChange={(measurementId) => change({ measurementId })}
          />
          <Check
            label={t("site.settings.consentBanner")}
            checked={form.consentBanner}
            onChange={(consentBanner) => change({ consentBanner })}
          />
        </TabsContent>

        <TabsContent value="forms" className="grid gap-3 pt-3">
          <Field label={t("site.settings.formService")} hint={t("site.settings.formServiceHint")}>
            {(control) => (
              <select
                {...control}
                className={cn(fieldControlClass, "w-48")}
                value={form.formService}
                onChange={(event) => {
                  const { value } = event.currentTarget;
                  const formService = FORM_SERVICES.find((service) => service === value);
                  if (formService !== undefined) change({ formService, formValue: "" });
                }}
              >
                {FORM_SERVICES.map((service) => (
                  <option key={service} value={service}>
                    {t(`site.settings.formService.${service === "" ? "none" : service}`)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          {form.formService === "" || form.formService === "netlify" ? null : (
            <TextInput
              label={t(`site.settings.formValue.${form.formService}`)}
              {...(form.formService === "custom"
                ? { hint: t("site.settings.formValue.customHint") }
                : {})}
              error={errors["forms.value"]}
              type={
                form.formService === "formsubmit"
                  ? "email"
                  : form.formService === "custom"
                    ? "url"
                    : "text"
              }
              value={form.formValue}
              onChange={(formValue) => change({ formValue })}
            />
          )}
        </TabsContent>
      </Tabs>

      {Object.keys(errors).length === 0 ? null : (
        <p role="alert" className="m-0 text-xs text-destructive-text">
          {t("site.settings.fixErrors")}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t("site.settings.cancel")}
        </Button>
        <Button type="submit">{t("site.settings.save")}</Button>
      </DialogFooter>
    </form>
  );
}

/**
 * What an input needs to show a field's error: `aria-invalid`, and `aria-describedby` pointing at
 * its hint and its message.
 */
function errorProps(field: string, errors: Readonly<Record<string, string>>) {
  return errors[field] === undefined
    ? {}
    : ({ "aria-invalid": true, "aria-describedby": errorId(field) } as const);
}

/** The id of the error under an inline control (a row of profiles or opening hours). */
const errorId = (field: string) => `error-${field}`;

/** The section a field is in: the first part of its path. */
function sectionOf(field: string): string {
  return field.split(".")[0] ?? "";
}

/** A choice of one of Media's images, or none. */
function ImagePicker({
  name,
  legend,
  hint,
  images,
  imageUrl,
  value,
  onChange,
}: {
  readonly name: string;
  readonly legend: string;
  readonly hint: string;
  readonly images: readonly ImageMeta[];
  readonly imageUrl: (item: ImageMeta) => string;
  readonly value: MediaId | undefined;
  readonly onChange: (value: MediaId | undefined) => void;
}) {
  return (
    <fieldset className="grid gap-1">
      <legend className="mb-1 text-xs text-muted-foreground">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        <ImageChoice
          name={name}
          label={t("site.settings.noImage")}
          selected={value === undefined}
          onSelect={() => onChange(undefined)}
        />
        {images.map((image) => (
          <ImageChoice
            key={image.id}
            name={name}
            label={image.fileName}
            thumbnail={imageUrl(image)}
            selected={value === image.id}
            onSelect={() => onChange(image.id)}
          />
        ))}
      </div>
      <p className="m-0 text-xs text-muted-foreground">
        {images.length === 0 ? t("site.settings.noImages") : hint}
      </p>
    </fieldset>
  );
}

/** Opening hours: rows of days and times, added and removed freely. */
function OpeningHours({
  form,
  errors,
  invalid,
  change,
}: {
  readonly form: SettingsForm;
  readonly errors: Readonly<Record<string, string>>;
  readonly invalid: (field: string) => Record<string, unknown>;
  readonly change: (next: Partial<SettingsForm>) => void;
}) {
  const replace = (index: number, next: Partial<SettingsForm["openingHours"][number]>) =>
    change({
      openingHours: form.openingHours.map((hours, at) =>
        at === index ? { ...hours, ...next } : hours,
      ),
    });
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-xs text-muted-foreground">
        {t("site.settings.openingHours")}
      </legend>
      {form.openingHours.map((hours, index) => {
        const field = `contact.openingHours.${index}`;
        return (
          <div key={index} className="grid gap-1 rounded-sm border border-border p-2">
            <fieldset className="flex flex-wrap items-center gap-1" {...invalid(`${field}.days`)}>
              <legend className="sr-only">{t("site.settings.days")}</legend>
              {DAYS.map((day) => (
                <label
                  key={day}
                  className={cn(
                    "flex h-7 cursor-pointer items-center rounded-sm border border-border px-2 text-xs",
                    "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                    hours.days.includes(day) && "border-primary bg-accent text-accent-foreground",
                  )}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={hours.days.includes(day)}
                    onChange={(event) =>
                      replace(index, {
                        days: event.currentTarget.checked
                          ? [...hours.days, day]
                          : hours.days.filter((other) => other !== day),
                      })
                    }
                  />
                  {t(`site.settings.day.${day}`)}
                </label>
              ))}
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="ml-auto"
                aria-label={t("site.settings.removeHours")}
                title={t("site.settings.removeHours")}
                onClick={() =>
                  change({ openingHours: form.openingHours.filter((_, at) => at !== index) })
                }
              >
                <XIcon />
              </Button>
            </fieldset>
            <ErrorText id={errorId(`${field}.days`)} message={errors[`${field}.days`]} />
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <TimeInput
                label={t("site.settings.opens")}
                value={hours.opens}
                error={errors[`${field}.opens`]}
                onChange={(opens) => replace(index, { opens })}
              />
              <TimeInput
                label={t("site.settings.closes")}
                value={hours.closes}
                error={errors[`${field}.closes`]}
                onChange={(closes) => replace(index, { closes })}
              />
            </div>
          </div>
        );
      })}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="justify-self-start"
        onClick={() =>
          change({
            openingHours: [...form.openingHours, { days: [], opens: "09:00", closes: "17:00" }],
          })
        }
      >
        <PlusIcon />
        {t("site.settings.addHours")}
      </Button>
    </fieldset>
  );
}
