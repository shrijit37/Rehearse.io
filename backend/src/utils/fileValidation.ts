export function validateBase64Field(value: string | undefined | null, fieldName: string): { isValid: boolean; message?: string } {
    if (!value) return { isValid: true };
    if (typeof value !== "string") {
        return { isValid: false, message: `${fieldName} must be a string` };
    }
    const raw = value.includes(",") ? (value.split(",")[1] || "") : value;
    if (!/^[A-Za-z0-9+/=\s]*$/.test(raw)) {
        return { isValid: false, message: `${fieldName} is not valid base64` };
    }
    const sizeBytes = Math.ceil((raw.length * 3) / 4);
    const MAX_FIELD_SIZE = 5 * 1024 * 1024; // 5 MB
    if (sizeBytes > MAX_FIELD_SIZE) {
        return { isValid: false, message: `${fieldName} exceeds 5 MB size limit` };
    }
    return { isValid: true };
}

export function validatePdfFormat(resume: string): boolean {
    const rawResume = resume.includes(",") ? (resume.split(",")[1] || "") : resume;
    const resumeBuffer = Buffer.from(rawResume, "base64");
    return resumeBuffer.length >= 4 && resumeBuffer.toString("utf8", 0, 4) === "%PDF";
}

export function validatePhotoFormat(photo: string): boolean {
    const rawPhoto = photo.includes(",") ? (photo.split(",")[1] || "") : photo;
    const photoBuffer = Buffer.from(rawPhoto, "base64");
    // Magic bytes are binary: compare hex, not a utf8 decode. JPEG starts FF D8 FF
    // and PNG 89 50 4E 47 — decoded as text these become U+FFFD and never matched,
    // so every real photo was rejected.
    const photoHeader = photoBuffer.toString("hex", 0, 3).toLowerCase();
    return photoHeader === "ffd8ff" || photoHeader === "89504e";
}

export function validateAudioFormat(audio: string): boolean {
    const rawAudio = audio.includes(",") ? (audio.split(",")[1] || "") : audio;
    const audioBuffer = Buffer.from(rawAudio, "base64");
    const audioHeader = audioBuffer.toString("hex", 0, 4);
    return !!audioHeader.match(/^(52494646|1a45dfa3|494433)/);
}
