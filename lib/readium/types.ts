export interface ReadiumLink {
    href: string;
    type: string;
    rel?: string;
    height?: number;
    width?: number;
    title?: string;
    properties?: any;
    templated?: boolean;
    children?: ReadiumLink[];
}

export interface ReadiumMetadata {
    "@type"?: string;
    title: string;
    author?: string;
    identifier?: string;
    language?: string;
    modified?: string;
    published?: string;
    publisher?: string;
    subjects?: string[];
    readingProgression?: "rtl" | "ltr" | "ttb" | "btt" | "auto";
    [key: string]: any;
}

export interface ReadiumManifest {
    "@context"?: string | string[];
    metadata: ReadiumMetadata;
    links: ReadiumLink[];
    readingOrder: ReadiumLink[];
    resources?: ReadiumLink[];
    toc?: ReadiumLink[];
    subcollections?: {
        [key: string]: ReadiumLink[];
    };
}
