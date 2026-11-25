import { useMutation, useQueryClient } from '@tanstack/react-query';

import { submitPrice } from '../services/submitService';

export function useSubmitPrice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitPrice,
    // Never retry on its own: if the first request reached the server and
    // only the answer got lost, a retry would post the same price twice.
    retry: false,
    onSuccess: () => {
      // Searches, product pages and price drops may now be out of date.
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['priceDrops'] });
      // The new price should show up on the Activity tab.
      queryClient.invalidateQueries({ queryKey: ['myActivity'] });
    },
  });
}
