# Análise: erros 503/504 no console

## O que os erros mostram
- Quase todas as chamadas ao servidor (tarefas, notificações, permissões de menu, papéis) responderam 503/504 ao mesmo tempo: o servidor ficou sem resposta, não é bug de uma tela.
- O 400 em `refresh_token` é consequência: a sessão não conseguiu renovar durante a queda. Basta entrar de novo.
- Os avisos amarelos (React Router, DialogContent) são inofensivos.

## Situação agora
- Backend verificado agora: ativo e respondendo (banco ~119ms). A ligação login→banco ainda está lenta (~4s), sinal de que acabou de se recuperar de sobrecarga.

## Causa provável
- Mesmo padrão das quedas anteriores: o servidor está no menor tamanho (Tiny) e trava sob carga de ranking e listas de tarefas.

## Opções
1. Subir para Mini (~0,02 crédito a mais por hora) — a solução mais segura para parar as quedas.
2. Continuar otimizando ranking e listas pesadas — alivia, mas não garante.
