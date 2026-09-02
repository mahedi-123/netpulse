declare module "@m-lab/ndt7" {
  export interface Ndt7Config {
    server?: string;
    protocol?: "wss" | "ws";
    metadata?: Record<string, string>;
    loadbalancer?: string;
    clientRegistrationToken?: string;
    userAcceptedDataPolicy?: boolean;
    mlabDataPolicyInapplicable?: boolean;
    downloadworkerfile?: string;
    uploadworkerfile?: string;
  }

  export interface Ndt7ServerChosen {
    machine?: string;
    location?: { city?: string; country?: string };
    [key: string]: unknown;
  }

  export interface Ndt7Callbacks {
    error?: (msg: string) => void;
    serverDiscovery?: (info: { loadbalancer: URL }) => void;
    serverChosen?: (server: Ndt7ServerChosen) => void;
    downloadStart?: (data: unknown) => void;
    downloadMeasurement?: (result: { Source: "client" | "server"; Data: any }) => void;
    downloadComplete?: (result: { LastClientMeasurement: any; LastServerMeasurement: any }) => void;
    uploadStart?: (data: unknown) => void;
    uploadMeasurement?: (result: { Source: "client" | "server"; Data: any }) => void;
    uploadComplete?: (result: { LastClientMeasurement: any; LastServerMeasurement: any }) => void;
  }

  export interface Ndt7Client {
    discoverServerURLs(config: Ndt7Config, callbacks?: Ndt7Callbacks): Promise<Record<string, string>>;
    downloadTest(config: Ndt7Config, callbacks: Ndt7Callbacks, urlPromise: Promise<Record<string, string>>): Promise<number>;
    uploadTest(config: Ndt7Config, callbacks: Ndt7Callbacks, urlPromise: Promise<Record<string, string>>): Promise<number>;
    test(config: Ndt7Config, callbacks: Ndt7Callbacks): Promise<number>;
  }

  const ndt7: Ndt7Client;
  export default ndt7;
}
