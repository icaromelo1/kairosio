<template>
  <LegalLayout titulo="Termos de uso" :atualizado="ATUALIZADO">
    <p>
      Estes termos valem entre você e Icaro Melo, criador independente do Kairos. Ao criar uma conta ou entrar com Google ou
      GitHub, você concorda com eles e com a <RouterLink to="/privacidade">política de privacidade</RouterLink>.
    </p>

    <h2>O serviço</h2>
    <p>
      O Kairos é um escritório virtual: cada servidor é um mundo onde as pessoas andam, conversam por voz, vídeo e texto,
      compartilham a tela e organizam o trabalho. O serviço evolui com frequência e algumas funções podem mudar ou sair.
    </p>

    <h2>Conta</h2>
    <ul>
      <li>Você precisa ter {{ IDADE_MINIMA }} anos ou mais.</li>
      <li>Você responde pelo que acontece na sua conta. Guarde a senha e não a compartilhe.</li>
      <li>O @nome não pode imitar outra pessoa nem ser ofensivo.</li>
    </ul>

    <h2>Servidores e o que você publica</h2>
    <ul>
      <li>O dono e os administradores de cada servidor decidem quem entra e moderam o que acontece nele.</li>
      <li>O que você escreve, fala ou compartilha continua sendo seu. Você nos autoriza a guardar e exibir esse conteúdo para as pessoas do servidor, só para o Kairos funcionar.</li>
      <li>Músicas e links que você coloca na jukebox são de sua responsabilidade; use só o que você tem direito de compartilhar.</li>
    </ul>

    <h2>O que não é permitido</h2>
    <ul>
      <li>Assédio, ameaças, discurso de ódio, conteúdo sexual envolvendo menores ou qualquer coisa ilegal.</li>
      <li>Gravar ou divulgar voz, vídeo ou tela de outras pessoas sem consentimento delas.</li>
      <li>Tentar invadir, sobrecarregar ou burlar o serviço, ou usar robôs sem autorização.</li>
    </ul>
    <p>Podemos suspender ou encerrar contas que descumpram estas regras.</p>

    <h2>Planos pagos</h2>
    <p>
      Hoje o Kairos é gratuito. Se surgirem planos pagos, preço, o que está incluído e a forma de cobrança aparecem antes
      da compra. Você poderá cancelar quando quiser, e o cancelamento vale ao fim do período já pago. Em compras pela
      internet, você tem 7 dias para desistir e receber o valor de volta, como prevê o Código de Defesa do Consumidor.
    </p>

    <h2>Disponibilidade e fim do serviço</h2>
    <p>
      Fazemos o possível para o Kairos ficar no ar, mas pode haver quedas e manutenções. Se o serviço for encerrar, avisamos
      com pelo menos 30 dias de antecedência e explicamos como você pode levar seus dados.
    </p>

    <h2>Responsabilidade</h2>
    <p>
      O Kairos é oferecido como está. Na medida em que a lei permite, não respondemos por danos indiretos nem pelo que as
      pessoas publicam nos servidores. Nada aqui tira direitos que você tem como consumidor.
    </p>

    <h2>Lei e contato</h2>
    <p>
      Estes termos seguem a lei brasileira. Dúvidas: <a :href="`mailto:${CONTATO}`">{{ CONTATO }}</a> ou a página de
      <RouterLink to="/suporte">suporte</RouterLink>. Quando os termos mudarem de forma relevante, avisamos dentro do Kairos
      antes de valer.
    </p>
  </LegalLayout>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import LegalLayout from './LegalLayout.vue'
import { ATUALIZADO, CONTATO, IDADE_MINIMA } from './legal'
</script>
