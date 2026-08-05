import { useCallback } from 'react';
import { GetSecurityQuestionsUseCase } from '@domain/usecases/security/GetSecurityQuestionsUseCase';
import { SetupSecurityQuestionsUseCase, SecurityQuestionInput } from '@domain/usecases/security/SetupSecurityQuestionsUseCase';
import { DIContainer } from '@core/di/container';

/**
 * Integration hook for vault security questions: reads existing questions and
 * persists new ones (authorized by the current PIN).
 */
export function useSecurityQuestions() {
  const getUseCase = DIContainer.resolve<GetSecurityQuestionsUseCase>('GetSecurityQuestionsUseCase');
  const setupUseCase = DIContainer.resolve<SetupSecurityQuestionsUseCase>('SetupSecurityQuestionsUseCase');

  const getQuestions = useCallback(async (vaultId: string) => {
    const result = await getUseCase.execute(vaultId);
    return result.success ? result.data : [];
  }, [getUseCase]);

  const setup = useCallback((vaultId: string, currentPin: string, inputs: SecurityQuestionInput[]) => {
    return setupUseCase.execute(vaultId, currentPin, inputs);
  }, [setupUseCase]);

  return { getQuestions, setup };
}