import { AiError, describe_cause, evaluate } from '@ooko/ai';
import { AiRequest } from '@ooko/contracts';
import { HttpError, post_handler } from '@ooko/http';
import { protect } from '../lib/auth.ts';

// Krok 3: body za pravidlá z krokov 1 a 2 a hodnotenie kritérií s pokynom pre AI.
// Bez AI (`provider: 'none'`) iba body za pravidlá. API kľúč sa nikde neukladá ani neloguje.
export const POST = protect(
  post_handler(AiRequest, async (req) => {
    try {
      return await evaluate(req);
    } catch (err) {
      if (err instanceof AiError) {
        // Celú chybu nelogujeme, obsahuje prompt s kódom študenta.
        console.warn(
          JSON.stringify({
            step: 'ai',
            code: err.code,
            message: err.message,
            ...describe_cause(err),
          }),
        );
        throw new HttpError(err.code === 'bad_request' ? 400 : 502, err.code, err.message);
      }
      throw err;
    }
  }),
);
