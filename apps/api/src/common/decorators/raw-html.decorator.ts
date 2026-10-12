import { SetMetadata } from '@nestjs/common';

/** Skip the JSON response envelope and send the handler string as HTML. */
export const RAW_HTML_KEY = 'rawHtml';

export const RawHtml = (): ReturnType<typeof SetMetadata> =>
    SetMetadata(RAW_HTML_KEY, true);
